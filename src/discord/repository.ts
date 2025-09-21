/**
 * Enhanced repository with Discord-specific operations and caching
 * Extends the base repository with Discord bot optimizations
 */

import { Repository, RepositoryConfig } from '../repository-types';
import { DatabaseObject, Purgeable, IdentifiedEntity } from '../types';
import { validateGuildId } from './entities';

/**
 * Enhanced repository configuration for Discord bots
 */
export interface DiscordRepositoryConfig extends RepositoryConfig {
  /**
   * Enable caching for frequently accessed data (default: true)
   */
  enableCaching?: boolean;

  /**
   * Cache TTL in milliseconds (default: 5 minutes)
   */
  cacheTTL?: number;

  /**
   * Maximum cache size (number of entries, default: 1000)
   */
  maxCacheSize?: number;

  /**
   * Enable automatic Discord ID validation (default: true)
   */
  validateDiscordIds?: boolean;
}

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Enhanced repository for Discord bot operations with caching and validation
 */
export class DiscordRepository implements Repository {
  private baseRepository: Repository;
  private config: DiscordRepositoryConfig | null = null;
  private cache = new Map<string, CacheEntry<any>>();
  private cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };

  constructor(baseRepository: Repository) {
    this.baseRepository = baseRepository;
  }

  /**
   * Initialize the Discord-enhanced repository
   */
  async initialize(config: DiscordRepositoryConfig): Promise<void> {
    this.config = {
      enableCaching: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      maxCacheSize: 1000,
      validateDiscordIds: true,
      ...config
    };

    await this.baseRepository.initialize(this.config);
  }

  /**
   * Check if the repository is initialized
   */
  isInitialized(): boolean {
    return this.baseRepository.isInitialized();
  }

  /**
   * Generate cache key for entity queries
   */
  private getCacheKey(entityType: string, guildId: string, suffix?: string): string {
    return `${entityType}:${guildId}${suffix ? `:${suffix}` : ''}`;
  }

  /**
   * Get data from cache or return undefined if not found/expired
   */
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

  /**
   * Store data in cache with TTL
   */
  private setCache<T>(key: string, data: T): void {
    if (!this.config?.enableCaching) return;

    // Evict old entries if cache is full
    if (this.cache.size >= this.config.maxCacheSize!) {
      this.evictOldestEntries();
    }

    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + this.config.cacheTTL!,
      accessCount: 1,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
  }

  /**
   * Evict least recently used cache entries
   */
  private evictOldestEntries(): void {
    const entries = Array.from(this.cache.entries());

    // Sort by last accessed time (oldest first)
    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    // Remove oldest 20% of entries
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
      this.cacheStats.evictions++;
    }
  }

  /**
   * Clear cache for a specific guild
   */
  clearGuildCache(guildId: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key =>
      key.includes(`:${guildId}`)
    );

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Validate Discord entity before storage
   */
  private validateDiscordEntity<T extends DatabaseObject>(object: T): void {
    if (!this.config?.validateDiscordIds) return;

    // Validate guild ID
    validateGuildId(object.guildId);

    // Additional validation for identified entities
    if ('id' in object && typeof (object as any).id === 'string') {
      const id = (object as any).id;
      if (!/^\d{17,19}$/.test(id)) {
        throw new Error(`Invalid Discord ID format: ${id}`);
      }
    }

    // Validate common Discord ID fields
    const commonIdFields = ['userId', 'channelId', 'roleId', 'moderatorId'];
    for (const field of commonIdFields) {
      if (field in object && typeof (object as any)[field] === 'string') {
        const id = (object as any)[field];
        if (!/^\d{17,19}$/.test(id)) {
          throw new Error(`Invalid Discord ID format in ${field}: ${id}`);
        }
      }
    }
  }

  /**
   * Store a Discord entity with validation and cache invalidation
   */
  async store<T extends DatabaseObject>(object: T): Promise<void> {
    this.validateDiscordEntity(object);

    await this.baseRepository.store(object);

    // Invalidate cache for this entity type and guild
    const storageKey = (object.constructor as any).storageKey;
    if (storageKey) {
      const cacheKey = this.getCacheKey(storageKey, object.guildId);
      this.cache.delete(cacheKey);
    }
  }

  /**
   * Store collection with cache invalidation
   */
  async storeCollection<T = any>(storageKey: string, collection: { guildId: string; data: T[] }): Promise<void> {
    validateGuildId(collection.guildId);

    await this.baseRepository.storeCollection(storageKey, collection);

    // Invalidate cache
    const cacheKey = this.getCacheKey(storageKey, collection.guildId, 'collection');
    this.cache.delete(cacheKey);
  }

  /**
   * Get all entities with caching support
   */
  async getAll<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    guildId: string
  ): Promise<T[]> {
    validateGuildId(guildId);

    const storageKey = (EntityClass as any).storageKey;
    if (!storageKey) {
      throw new Error('Entity class must have a static storageKey property');
    }

    // Try cache first
    const cacheKey = this.getCacheKey(storageKey, guildId);
    const cached = this.getFromCache<T[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const result = await this.baseRepository.getAll(EntityClass, guildId);

    // Cache the result
    this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Get entity by ID with caching
   */
  async getById<T extends IdentifiedEntity>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    entityId: string
  ): Promise<T | null> {
    validateGuildId(guildId);

    const storageKey = (EntityClass as any).storageKey;
    if (!storageKey) {
      throw new Error('Entity class must have a static storageKey property');
    }

    // Try cache first
    const cacheKey = this.getCacheKey(storageKey, guildId, entityId);
    const cached = this.getFromCache<T>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch all and find by ID
    const allEntities = await this.getAll(EntityClass, guildId);
    const entity = allEntities.find(e => e.id === entityId) || null;

    // Cache the result (even null results to prevent repeated queries)
    this.setCache(cacheKey, entity);

    return entity;
  }

  /**
   * Replace all entities with cache invalidation
   */
  async replaceAll<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    objects: T[]
  ): Promise<void> {
    validateGuildId(guildId);

    // Validate all objects
    objects.forEach(obj => this.validateDiscordEntity(obj));

    await this.baseRepository.replaceAll(EntityClass, guildId, objects);

    // Clear cache for this entity type and guild
    const storageKey = (EntityClass as any).storageKey;
    if (storageKey) {
      const cacheKeyPrefix = this.getCacheKey(storageKey, guildId);
      const keysToDelete = Array.from(this.cache.keys()).filter(key =>
        key.startsWith(cacheKeyPrefix)
      );
      keysToDelete.forEach(key => this.cache.delete(key));
    }
  }

  /**
   * Delete by ID with cache invalidation
   */
  async deleteById<T extends IdentifiedEntity>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    objectId: string
  ): Promise<boolean> {
    validateGuildId(guildId);

    const result = await this.baseRepository.deleteById(EntityClass, guildId, objectId);

    if (result) {
      // Clear cache for this entity type and guild
      const storageKey = (EntityClass as any).storageKey;
      if (storageKey) {
        const cacheKeyPrefix = this.getCacheKey(storageKey, guildId);
        const keysToDelete = Array.from(this.cache.keys()).filter(key =>
          key.startsWith(cacheKeyPrefix)
        );
        keysToDelete.forEach(key => this.cache.delete(key));
      }
    }

    return result;
  }

  /**
   * Purge stale items with cache invalidation
   */
  async purgeStaleItems<T extends DatabaseObject & Purgeable>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    maxAgeHours: number = 168
  ): Promise<number> {
    validateGuildId(guildId);

    const result = await this.baseRepository.purgeStaleItems(EntityClass, guildId, maxAgeHours);

    if (result > 0) {
      // Clear cache for this entity type and guild
      const storageKey = (EntityClass as any).storageKey;
      if (storageKey) {
        const cacheKeyPrefix = this.getCacheKey(storageKey, guildId);
        const keysToDelete = Array.from(this.cache.keys()).filter(key =>
          key.startsWith(cacheKeyPrefix)
        );
        keysToDelete.forEach(key => this.cache.delete(key));
      }
    }

    return result;
  }

  /**
   * Bulk operations for efficient Discord operations
   */
  async bulkStore<T extends DatabaseObject>(objects: T[]): Promise<void> {
    if (objects.length === 0) return;

    // Validate all objects
    objects.forEach(obj => this.validateDiscordEntity(obj));

    // Group by entity type and guild
    const groups = new Map<string, Map<string, T[]>>();

    objects.forEach(obj => {
      const storageKey = (obj.constructor as any).storageKey;
      if (!storageKey) return;

      if (!groups.has(storageKey)) {
        groups.set(storageKey, new Map());
      }

      const guildMap = groups.get(storageKey)!;
      if (!guildMap.has(obj.guildId)) {
        guildMap.set(obj.guildId, []);
      }

      guildMap.get(obj.guildId)!.push(obj);
    });

    // Store each group
    for (const [storageKey, guildMap] of groups) {
      for (const [guildId, groupObjects] of guildMap) {
        for (const obj of groupObjects) {
          await this.baseRepository.store(obj);
        }

        // Invalidate cache for this group
        const cacheKey = this.getCacheKey(storageKey, guildId);
        this.cache.delete(cacheKey);
      }
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { hits: number; misses: number; evictions: number; size: number; hitRate: number } {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? this.cacheStats.hits / total : 0;

    return {
      ...this.cacheStats,
      size: this.cache.size,
      hitRate: Math.round(hitRate * 10000) / 100 // Percentage with 2 decimal places
    };
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Get entities by field value (with caching)
   */
  async getByField<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    fieldName: string,
    fieldValue: any
  ): Promise<T[]> {
    const allEntities = await this.getAll(EntityClass, guildId);
    return allEntities.filter(entity => (entity as any)[fieldName] === fieldValue);
  }

  /**
   * Count entities of a specific type
   */
  async count<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    guildId: string
  ): Promise<number> {
    const entities = await this.getAll(EntityClass, guildId);
    return entities.length;
  }

  /**
   * Check if entity exists
   */
  async exists<T extends IdentifiedEntity>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    entityId: string
  ): Promise<boolean> {
    const entity = await this.getById(EntityClass, guildId, entityId);
    return entity !== null;
  }

  /**
   * Flush pending writes to storage
   */
  async flushPendingWrites(): Promise<void> {
    await this.baseRepository.flushPendingWrites();
  }
}