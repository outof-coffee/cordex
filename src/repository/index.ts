import { Repository, RepositoryConfig, DatabaseData, PendingWrite, PerformanceMetrics } from './types';
import { DatabaseObject, DatabaseCollection, Purgeable, IdentifiedEntity } from '../types';

class DatabaseRepository implements Repository {
  private config: RepositoryConfig | null = null;
  private initialized = false;
  private dbInstance: any | null = null;
  private pendingWrites: PendingWrite[] = [];
  private writeTimeout: NodeJS.Timeout | null = null;
  private isWriting = false;
  private metrics: PerformanceMetrics = {
    totalWrites: 0,
    batchedWrites: 0,
    avgWriteTime: 0,
    lastWriteTime: 0
  };

  private readonly BATCH_DELAY_MS = 50;
  private readonly MAX_BATCH_SIZE = 100;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 100;

  private async initializeDatabase(databasePath: string): Promise<void> {
    if (this.dbInstance === null) {
      try {
        const { JSONFilePreset } = await import('lowdb/node');
        this.dbInstance = await JSONFilePreset<DatabaseData>(databasePath, {});
      } catch (error) {
        this.dbInstance = null;
        throw error;
      }
    }
  }

  private async performBatchWrite(): Promise<void> {
    if (this.pendingWrites.length === 0 || this.isWriting) return;

    this.isWriting = true;
    const batch = this.pendingWrites.splice(0, this.MAX_BATCH_SIZE);
    const startTime = Date.now();

    try {
      await this.initializeDatabase(this.config!.databasePath);

      if (!this.dbInstance) {
        throw new Error('Failed to initialize database');
      }

      // Process all pending writes in batch
      for (const write of batch) {
        const { guildId, storageKey, data } = write;

        if (!this.dbInstance.data[guildId]) {
          this.dbInstance.data[guildId] = {};
        }

        if (!this.dbInstance.data[guildId][storageKey]) {
          this.dbInstance.data[guildId][storageKey] = [];
        }

        (this.dbInstance.data[guildId][storageKey] as any[]).push(data);
      }

      // Single write for entire batch
      await this.dbInstance.write();

      // Update metrics
      const writeTime = Date.now() - startTime;
      this.metrics.totalWrites++;
      this.metrics.batchedWrites += batch.length;
      this.metrics.avgWriteTime = (this.metrics.avgWriteTime + writeTime) / 2;
      this.metrics.lastWriteTime = writeTime;

      // Resolve all promises
      batch.forEach(write => write.resolve());

    } catch (error) {
      // Reject all promises
      batch.forEach(write => write.reject(error as Error));
    } finally {
      this.isWriting = false;

      // Schedule next batch if there are more writes pending
      if (this.pendingWrites.length > 0) {
        this.scheduleBatchWrite(); // Don't reset - just schedule if not already scheduled
      }
    }
  }

  private scheduleBatchWrite(resetExisting: boolean = false): void {
    if (this.writeTimeout) {
      if (!resetExisting) return;
      clearTimeout(this.writeTimeout);
    }

    this.writeTimeout = setTimeout(() => {
      this.writeTimeout = null;
      this.performBatchWrite();
    }, this.BATCH_DELAY_MS);
  }

  private async storeData(
    guildId: string,
    storageKey: string,
    data: DatabaseObject | DatabaseCollection<any>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pendingWrites.push({
        guildId,
        storageKey,
        data,
        resolve,
        reject
      });

      this.scheduleBatchWrite(true); // Reset existing timer when new items arrive
    });
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS * attempt));
        }
      }
    }

    throw lastError!;
  }

  async initialize(config: RepositoryConfig): Promise<void> {
    this.config = config;
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized && this.config !== null;
  }

  async store<T extends DatabaseObject>(object: T): Promise<void> {
    if (!this.isInitialized()) return;

    return this.executeWithRetry(async () => {
      const { guildId } = object;
      const storageKey = (object.constructor as any).storageKey;

      if (!storageKey) {
        throw new Error('Object class must have a static storageKey property');
      }

      await this.storeData(guildId, storageKey, object);
    });
  }

  async storeCollection<T = any>(storageKey: string, collection: DatabaseCollection<T>): Promise<void> {
    if (!this.isInitialized()) return;

    return this.executeWithRetry(async () => {
      const { guildId } = collection;
      await this.storeData(guildId, storageKey, collection);
    });
  }

  async getAll<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    guildId: string
  ): Promise<T[]> {
    if (!this.isInitialized()) return [];

    return this.executeWithRetry(async () => {
      const storageKey = (EntityClass as any).storageKey;
      if (!storageKey) {
        throw new Error('Entity class must have a static storageKey property');
      }

      await this.initializeDatabase(this.config!.databasePath);

      if (!this.dbInstance) {
        throw new Error('Failed to initialize database');
      }

      if (!this.dbInstance.data[guildId] || !this.dbInstance.data[guildId][storageKey]) {
        return [];
      }

      const storedData = this.dbInstance.data[guildId][storageKey] as any[];

      return storedData.map((item: any) => {
        try {
          if (item.guildId) {
            const { guildId: itemGuildId, ...otherProps } = item;
            const propValues = Object.values(otherProps);
            return new EntityClass(itemGuildId, ...propValues);
          }
          return item as T;
        } catch (error) {
          return item as T;
        }
      });
    });
  }

  async purgeStaleItems<T extends DatabaseObject & Purgeable>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    maxAgeHours: number = 168
  ): Promise<number> {
    if (!this.isInitialized()) return 0;

    return this.executeWithRetry(async () => {
      const storageKey = (EntityClass as any).storageKey;
      if (!storageKey) {
        throw new Error('Entity class must have a static storageKey property');
      }

      const allItems = await this.getAll(EntityClass, guildId);

      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);
      const cutoffTimestamp = cutoffTime.toISOString();

      const freshItems = allItems.filter(item => {
        const itemTimestamp = (item as Purgeable).timestamp;
        return itemTimestamp > cutoffTimestamp;
      });

      const purgedCount = allItems.length - freshItems.length;

      if (purgedCount > 0) {
        await this.replaceAll(EntityClass, guildId, freshItems);
      }

      return purgedCount;
    });
  }

  async replaceAll<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    objects: T[]
  ): Promise<void> {
    if (!this.isInitialized()) return;

    return this.executeWithRetry(async () => {
      const storageKey = (EntityClass as any).storageKey;
      if (!storageKey) {
        throw new Error('Entity class must have a static storageKey property');
      }

      await this.initializeDatabase(this.config!.databasePath);

      if (!this.dbInstance) {
        throw new Error('Failed to initialize database');
      }

      if (!this.dbInstance.data[guildId]) {
        this.dbInstance.data[guildId] = {};
      }

      this.dbInstance.data[guildId][storageKey] = objects;
      await this.dbInstance.write();
    });
  }

  async deleteById<T extends IdentifiedEntity>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    objectId: string
  ): Promise<boolean> {
    if (!this.isInitialized()) return false;

    return this.executeWithRetry(async () => {
      const allItems = await this.getAll(EntityClass, guildId);

      const itemIndex = allItems.findIndex((item: any) => item.id === objectId);

      if (itemIndex === -1) {
        return false;
      }

      const updatedItems = allItems.filter((_, index) => index !== itemIndex);
      await this.replaceAll(EntityClass, guildId, updatedItems);

      return true;
    });
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  async flushPendingWrites(): Promise<void> {
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
      this.writeTimeout = null;
    }
    await this.performBatchWrite();
  }
}

export const repository: Repository = new DatabaseRepository();

// Exports
export { Repository, RepositoryConfig, DatabaseObject } from './types';