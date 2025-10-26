import { Repository, RepositoryConfig, DatabaseData, PendingWrite, PerformanceMetrics, QueryOptions, QueryResult } from './types.js';
import { DatabaseObject, DatabaseCollection, Purgeable, IdentifiedEntity } from '../types.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

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
  private cache = new Map<string, CacheEntry<any>>();
  private cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0
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
        const { collectionKey, storageKey, data } = write;

        if (!this.dbInstance.data[collectionKey]) {
          this.dbInstance.data[collectionKey] = {};
        }

        if (!this.dbInstance.data[collectionKey][storageKey]) {
          this.dbInstance.data[collectionKey][storageKey] = [];
        }

        (this.dbInstance.data[collectionKey][storageKey] as any[]).push(data);
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
    collectionKey: string,
    storageKey: string,
    data: DatabaseObject | DatabaseCollection<any>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pendingWrites.push({
        collectionKey,
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
    this.config = {
      enableCaching: true,
      cacheTTL: 5 * 60 * 1000,
      maxCacheSize: 1000,
      ...config
    };
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized && this.config !== null;
  }

  private getCacheKey(entityType: string, collectionKey: string, suffix?: string): string {
    return suffix ? `${entityType}:${collectionKey}:${suffix}` : `${entityType}:${collectionKey}`;
  }

  private getFromCache<T>(key: string): T | undefined {
    if (!this.config?.enableCaching) return undefined;

    const entry = this.cache.get(key);
    if (!entry) {
      this.cacheStats.misses++;
      return undefined;
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.cacheStats.misses++;
      return undefined;
    }

    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.cacheStats.hits++;
    return entry.data;
  }

  private setCache<T>(key: string, data: T): void {
    if (!this.config?.enableCaching) return;

    if (this.cache.size >= this.config.maxCacheSize!) {
      this.evictOldestEntries();
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.config.cacheTTL!,
      accessCount: 1,
      lastAccessed: Date.now()
    });
  }

  private evictOldestEntries(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
      this.cacheStats.evictions++;
    }
  }

  private clearCacheByPattern(pattern: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(pattern));
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  async store<T extends DatabaseObject>(object: T): Promise<void> {
    if (!this.isInitialized()) return;

    return this.executeWithRetry(async () => {
      if (!this.config?.entityRegistry) {
        throw new Error(
          'EntityRegistry is required. Pass entityRegistry to repository.initialize()'
        );
      }

      const registration = this.config.entityRegistry.getRegistrationForInstance(object);
      if (!registration) {
        throw new Error(
          `Entity ${object.constructor.name} is not registered. Use entityRegistry.register() during initialization.`
        );
      }

      const collectionKey = registration.getCollectionKey(object);
      const storageKey = registration.storageKey;

      await this.storeData(collectionKey, storageKey, object);

      const cacheKey = this.getCacheKey(storageKey, collectionKey);
      this.clearCacheByPattern(cacheKey);
    });
  }

  async storeUnique<T extends DatabaseObject & IdentifiedEntity>(
    object: T
  ): Promise<boolean> {
    if (!this.isInitialized()) return false;

    return this.executeWithRetry(async () => {
      if (!this.config?.entityRegistry) {
        throw new Error(
          'EntityRegistry is required. Pass entityRegistry to repository.initialize()'
        );
      }

      const registration = this.config.entityRegistry.getRegistrationForInstance(object);
      if (!registration) {
        throw new Error(
          `Entity ${object.constructor.name} is not registered. Use entityRegistry.register() during initialization.`
        );
      }

      const collectionKey = registration.getCollectionKey(object);
      const storageKey = registration.storageKey;

      // Check if entity with this ID already exists
      const allItems = await this.getAll(object.constructor as any, collectionKey);
      const existingIndex = allItems.findIndex((item: any) => item.id === object.id);

      let isUpdate = false;
      if (existingIndex !== -1) {
        // Update existing entity: replace old entry with new one
        allItems[existingIndex] = object;
        await this.replaceAll(object.constructor as any, collectionKey, allItems);
        isUpdate = true;
      } else {
        // Insert new entity
        await this.storeData(collectionKey, storageKey, object);
      }

      const cacheKey = this.getCacheKey(storageKey, collectionKey);
      this.clearCacheByPattern(cacheKey);

      return isUpdate; // true if updated, false if inserted
    });
  }

  async storeCollection<T = any>(storageKey: string, collection: DatabaseCollection<T>): Promise<void> {
    if (!this.isInitialized()) return;

    return this.executeWithRetry(async () => {
      // DatabaseCollection still uses getCollectionKey() for now
      // as it's not a typical entity that would be registered
      const collectionKey = collection.getCollectionKey();
      await this.storeData(collectionKey, storageKey, collection);
    });
  }

  async getAll<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string
  ): Promise<T[]> {
    if (!this.isInitialized()) return [];

    return this.executeWithRetry(async () => {
      const storageKey = (EntityClass as any).storageKey;
      if (!storageKey) {
        throw new Error('Entity class must have a static storageKey property');
      }

      const cacheKey = this.getCacheKey(storageKey, collectionKey);
      const cached = this.getFromCache<T[]>(cacheKey);
      if (cached) {
        return cached;
      }

      await this.initializeDatabase(this.config!.databasePath);

      if (!this.dbInstance) {
        throw new Error('Failed to initialize database');
      }

      if (!this.dbInstance.data[collectionKey] || !this.dbInstance.data[collectionKey][storageKey]) {
        return [];
      }

      const storedData = this.dbInstance.data[collectionKey][storageKey] as any[];

      const result = storedData.map((item: any) => {
        try {
          return item as T;
        } catch (error) {
          return item as T;
        }
      });

      this.setCache(cacheKey, result);
      return result;
    });
  }

  async purgeStaleItems<T extends DatabaseObject & Purgeable>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    maxAgeHours: number = 168
  ): Promise<number> {
    if (!this.isInitialized()) return 0;

    return this.executeWithRetry(async () => {
      const storageKey = (EntityClass as any).storageKey;
      if (!storageKey) {
        throw new Error('Entity class must have a static storageKey property');
      }

      const allItems = await this.getAll(EntityClass, collectionKey);

      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);
      const cutoffTimestamp = cutoffTime.toISOString();

      const freshItems = allItems.filter(item => {
        const itemTimestamp = (item as Purgeable).timestamp;
        return itemTimestamp > cutoffTimestamp;
      });

      const purgedCount = allItems.length - freshItems.length;

      if (purgedCount > 0) {
        await this.replaceAll(EntityClass, collectionKey, freshItems);
      }

      return purgedCount;
    });
  }

  async replaceAll<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
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

      if (!this.dbInstance.data[collectionKey]) {
        this.dbInstance.data[collectionKey] = {};
      }

      this.dbInstance.data[collectionKey][storageKey] = objects;
      await this.dbInstance.write();

      const cacheKey = this.getCacheKey(storageKey, collectionKey);
      this.clearCacheByPattern(cacheKey);
    });
  }

  async deleteById<T extends IdentifiedEntity>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    objectId: string
  ): Promise<boolean> {
    if (!this.isInitialized()) return false;

    return this.executeWithRetry(async () => {
      const allItems = await this.getAll(EntityClass, collectionKey);

      // Filter ALL entries matching the ID, not just the first one (Defect 2 & 3 fix)
      const updatedItems = allItems.filter((item: any) => item.id !== objectId);

      // If no items were deleted, return false
      if (updatedItems.length === allItems.length) {
        return false;
      }

      await this.replaceAll(EntityClass, collectionKey, updatedItems);

      const storageKey = (EntityClass as any).storageKey;
      if (storageKey) {
        const cacheKey = this.getCacheKey(storageKey, collectionKey);
        this.clearCacheByPattern(cacheKey);
      }

      return true;
    });
  }

  async deleteUnique<T extends IdentifiedEntity>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    objectId: string
  ): Promise<boolean> {
    // Semantic alias for deleteById when working with unique entities
    // Makes intent explicit when paired with storeUnique()
    return this.deleteById(EntityClass, collectionKey, objectId);
  }

  async query<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    options: QueryOptions<T> = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();

    let entities = await this.getAll(EntityClass, collectionKey);
    const totalCount = entities.length;

    // Apply filter
    if (options.filter) {
      entities = entities.filter(options.filter);
    }

    // Apply sort
    if (options.sort) {
      entities.sort(options.sort);
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit;

    if (limit !== undefined) {
      entities = entities.slice(offset, offset + limit);
    } else if (offset > 0) {
      entities = entities.slice(offset);
    }

    const executionTimeMs = Date.now() - startTime;

    return {
      entities,
      totalCount,
      hasMore: limit !== undefined && (offset + limit) < totalCount,
      executionTimeMs
    };
  }

  async count<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    filter?: (entity: T) => boolean
  ): Promise<number> {
    const entities = await this.getAll(EntityClass, collectionKey);
    return filter ? entities.filter(filter).length : entities.length;
  }

  async getById<T extends IdentifiedEntity>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    entityId: string
  ): Promise<T | null> {
    const storageKey = (EntityClass as any).storageKey;
    if (!storageKey) {
      throw new Error('Entity class must have a static storageKey property');
    }

    const cacheKey = this.getCacheKey(storageKey, collectionKey, entityId);
    const cached = this.getFromCache<T>(cacheKey);
    if (cached) {
      return cached;
    }

    const allEntities = await this.getAll(EntityClass, collectionKey);
    const entity = allEntities.find(e => e.id === entityId) || null;

    this.setCache(cacheKey, entity);
    return entity;
  }

  async findByField<T extends DatabaseObject, K extends keyof T>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    fieldName: K,
    fieldValue: T[K]
  ): Promise<T[]> {
    const result = await this.query(EntityClass, collectionKey, {
      filter: (entity) => entity[fieldName] === fieldValue
    });
    return result.entities;
  }

  async findOneByField<T extends DatabaseObject, K extends keyof T>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    fieldName: K,
    fieldValue: T[K]
  ): Promise<T | null> {
    const results = await this.findByField(EntityClass, collectionKey, fieldName, fieldValue);
    return results.length > 0 ? results[0] : null;
  }

  async exists<T extends IdentifiedEntity>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    entityId: string
  ): Promise<boolean> {
    const entity = await this.getById(EntityClass, collectionKey, entityId);
    return entity !== null;
  }

  async getUserEntities<T extends DatabaseObject & { userId: string }>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    userId: string
  ): Promise<T[]> {
    return this.findByField(EntityClass, collectionKey, 'userId' as keyof T, userId as T[keyof T]);
  }

  async getChannelEntities<T extends DatabaseObject & { channelId: string }>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    channelId: string
  ): Promise<T[]> {
    return this.findByField(EntityClass, collectionKey, 'channelId' as keyof T, channelId as T[keyof T]);
  }

  async getActiveTemporary<T extends DatabaseObject & { isExpired(): boolean }>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string
  ): Promise<T[]> {
    const result = await this.query(EntityClass, collectionKey, {
      filter: (entity) => !entity.isExpired()
    });
    return result.entities;
  }

  async getExpiredTemporary<T extends DatabaseObject & { isExpired(): boolean }>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string
  ): Promise<T[]> {
    const result = await this.query(EntityClass, collectionKey, {
      filter: (entity) => entity.isExpired()
    });
    return result.entities;
  }

  async bulkStore<T extends DatabaseObject>(entities: T[]): Promise<BulkOperationResult> {
    const startTime = Date.now();
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
      executionTimeMs: 0
    };

    for (const entity of entities) {
      try {
        await this.store(entity);
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          entity,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    result.executionTimeMs = Date.now() - startTime;
    return result;
  }

  async bulkDelete<T extends IdentifiedEntity>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    entityIds: string[]
  ): Promise<BulkOperationResult> {
    const startTime = Date.now();
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
      executionTimeMs: 0
    };

    for (const entityId of entityIds) {
      try {
        const deleted = await this.deleteById(EntityClass, collectionKey, entityId);
        if (deleted) {
          result.successful++;
        } else {
          result.failed++;
          result.errors.push({
            entity: { id: entityId },
            error: 'Entity not found'
          });
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          entity: { id: entityId },
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    result.executionTimeMs = Date.now() - startTime;
    return result;
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

export interface BulkOperationResult {
  successful: number;
  failed: number;
  errors: Array<{ entity: any; error: string }>;
  executionTimeMs: number;
}

export const repository: Repository = new DatabaseRepository();

// Exports
export { Repository, RepositoryConfig, DatabaseObject, QueryOptions, QueryResult, EntityRegistry, CollectionKeyExtractor, EntityRegistration } from './types.js';
export { DatabaseRepository };