/**
 * Enhanced repository with type-safe operations and advanced entity management
 * Extends the base repository with powerful query and management capabilities
 */

import { Repository, repository } from './repository';
import { DatabaseObject, Purgeable, IdentifiedEntity } from './types';
import { DiscordRepository, DiscordRepositoryConfig } from './discord';
import { EntityRegistry, entityRegistry } from './entity-registry';
import { EntityUtils, UserDiscordEntity, ChannelDiscordEntity, TemporaryDiscordEntity, EventDiscordEntity } from './enhanced-entities';

/**
 * Query options for entity filtering and sorting
 */
export interface QueryOptions<T> {
  /** Filter function to apply to entities */
  filter?: (entity: T) => boolean;

  /** Sort function for ordering results */
  sort?: (a: T, b: T) => number;

  /** Maximum number of results to return */
  limit?: number;

  /** Number of results to skip */
  offset?: number;

  /** Include expired entities (for Purgeable entities) */
  includeExpired?: boolean;

  /** Maximum age in hours (for Purgeable entities) */
  maxAgeHours?: number;
}

/**
 * Result of a query operation with metadata
 */
export interface QueryResult<T> {
  /** The entities that matched the query */
  entities: T[];

  /** Total number of entities before limit/offset */
  totalCount: number;

  /** Whether there are more results available */
  hasMore: boolean;

  /** Query execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  /** Number of entities successfully processed */
  successful: number;

  /** Number of entities that failed */
  failed: number;

  /** Errors that occurred during processing */
  errors: Array<{ entity: any; error: string }>;

  /** Operation execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * Enhanced repository with advanced entity management capabilities
 */
export class EnhancedRepository implements Repository {
  private baseRepository: DiscordRepository;
  private registry: EntityRegistry;

  constructor(baseRepository?: Repository, registry?: EntityRegistry) {
    this.baseRepository = baseRepository instanceof DiscordRepository
      ? baseRepository
      : new DiscordRepository(baseRepository || repository);
    this.registry = registry || entityRegistry;
  }

  /**
   * Initialize the enhanced repository
   */
  async initialize(config: DiscordRepositoryConfig): Promise<void> {
    await this.baseRepository.initialize(config);
  }

  /**
   * Check if the repository is initialized
   */
  isInitialized(): boolean {
    return this.baseRepository.isInitialized();
  }

  // Delegate basic operations to base repository
  async store<T extends DatabaseObject>(object: T): Promise<void> {
    return this.baseRepository.store(object);
  }

  async storeCollection<T = any>(storageKey: string, collection: { guildId: string; data: T[] }): Promise<void> {
    return this.baseRepository.storeCollection(storageKey, collection);
  }

  async getAll<T extends DatabaseObject>(EntityClass: new (...args: any[]) => T, guildId: string): Promise<T[]> {
    return this.baseRepository.getAll(EntityClass, guildId);
  }

  async replaceAll<T extends DatabaseObject>(EntityClass: new (...args: any[]) => T, guildId: string, objects: T[]): Promise<void> {
    return this.baseRepository.replaceAll(EntityClass, guildId, objects);
  }

  async deleteById<T extends IdentifiedEntity>(EntityClass: new (...args: any[]) => T, guildId: string, objectId: string): Promise<boolean> {
    return this.baseRepository.deleteById(EntityClass, guildId, objectId);
  }

  async purgeStaleItems<T extends DatabaseObject & Purgeable>(EntityClass: new (...args: any[]) => T, guildId: string, maxAgeHours: number = 168): Promise<number> {
    return this.baseRepository.purgeStaleItems(EntityClass, guildId, maxAgeHours);
  }

  async flushPendingWrites(): Promise<void> {
    return this.baseRepository.flushPendingWrites();
  }

  // Enhanced operations

  /**
   * Advanced query with filtering, sorting, and pagination
   */
  async query<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    options: QueryOptions<T> = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();

    let entities = await this.getAll(EntityClass, guildId);

    // Apply purgeable filtering if applicable
    if (options.maxAgeHours !== undefined && EntityUtils.isPurgeable(entities[0])) {
      entities = EntityUtils.getFresh(entities as any[], options.maxAgeHours) as T[];
    } else if (!options.includeExpired && EntityUtils.isPurgeable(entities[0])) {
      // Default to filtering expired items
      entities = entities.filter(entity =>
        !(entity as any).isExpired || !(entity as any).isExpired()
      );
    }

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

  /**
   * Find entities by field value with type safety
   */
  async findByField<T extends DatabaseObject, K extends keyof T>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    fieldName: K,
    fieldValue: T[K]
  ): Promise<T[]> {
    return this.query(EntityClass, guildId, {
      filter: (entity) => entity[fieldName] === fieldValue
    }).then(result => result.entities);
  }

  /**
   * Find a single entity by field value
   */
  async findOneByField<T extends DatabaseObject, K extends keyof T>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    fieldName: K,
    fieldValue: T[K]
  ): Promise<T | null> {
    const results = await this.findByField(EntityClass, guildId, fieldName, fieldValue);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get entity by ID with enhanced type safety
   */
  async getById<T extends IdentifiedEntity>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    entityId: string
  ): Promise<T | null> {
    return this.baseRepository.getById(EntityClass, guildId, entityId);
  }

  /**
   * Check if entity exists
   */
  async exists<T extends IdentifiedEntity>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    entityId: string
  ): Promise<boolean> {
    return this.baseRepository.exists(EntityClass, guildId, entityId);
  }

  /**
   * Count entities with optional filtering
   */
  async count<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    filter?: (entity: T) => boolean
  ): Promise<number> {
    const entities = await this.getAll(EntityClass, guildId);
    return filter ? entities.filter(filter).length : entities.length;
  }

  /**
   * Bulk store operation with error handling
   */
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

  /**
   * Bulk delete operation with error handling
   */
  async bulkDelete<T extends IdentifiedEntity>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
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
        const deleted = await this.deleteById(EntityClass, guildId, entityId);
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

  /**
   * Get entities associated with a specific user
   */
  async getUserEntities<T extends UserDiscordEntity>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    userId: string
  ): Promise<T[]> {
    return this.findByField(EntityClass, guildId, 'userId', userId);
  }

  /**
   * Get entities associated with a specific channel
   */
  async getChannelEntities<T extends ChannelDiscordEntity>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    channelId: string
  ): Promise<T[]> {
    return this.findByField(EntityClass, guildId, 'channelId', channelId);
  }

  /**
   * Get active temporary entities (not expired)
   */
  async getActiveTemporary<T extends TemporaryDiscordEntity>(
    EntityClass: new (...args: any[]) => T,
    guildId: string
  ): Promise<T[]> {
    return this.query(EntityClass, guildId, {
      filter: (entity) => !entity.isExpired()
    }).then(result => result.entities);
  }

  /**
   * Get expired temporary entities
   */
  async getExpiredTemporary<T extends TemporaryDiscordEntity>(
    EntityClass: new (...args: any[]) => T,
    guildId: string
  ): Promise<T[]> {
    return this.query(EntityClass, guildId, {
      filter: (entity) => entity.isExpired()
    }).then(result => result.entities);
  }

  /**
   * Get events by type
   */
  async getEventsByType<T extends EventDiscordEntity>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    eventType: string
  ): Promise<T[]> {
    return this.findByField(EntityClass, guildId, 'eventType', eventType);
  }

  /**
   * Purge all expired temporary entities for a guild
   */
  async purgeExpiredTemporary(guildId: string): Promise<{ [storageKey: string]: number }> {
    const result: { [storageKey: string]: number } = {};
    const registrations = this.registry.getAllRegistrations();

    for (const registration of registrations) {
      // Check if this is a temporary entity type
      if (registration.storageKey.includes('temp-') || registration.tags.includes('temporary')) {
        try {
          const entities = await this.getAll(registration.entityClass as any, guildId);
          const expired = entities.filter(entity =>
            EntityUtils.isTemporary(entity) && entity.isExpired()
          );

          if (expired.length > 0) {
            const fresh = entities.filter(entity =>
              !EntityUtils.isTemporary(entity) || !entity.isExpired()
            );
            await this.replaceAll(registration.entityClass as any, guildId, fresh);
            result[registration.storageKey] = expired.length;
          }
        } catch (error) {
          console.warn(`Failed to purge expired entities for ${registration.storageKey}:`, error);
        }
      }
    }

    return result;
  }

  /**
   * Get repository statistics for a guild
   */
  async getGuildStats(guildId: string): Promise<{
    totalEntities: number;
    entitiesByType: { [storageKey: string]: number };
    purgeableEntities: number;
    identifiedEntities: number;
    temporaryEntities: number;
    expiredEntities: number;
  }> {
    const stats = {
      totalEntities: 0,
      entitiesByType: {} as { [storageKey: string]: number },
      purgeableEntities: 0,
      identifiedEntities: 0,
      temporaryEntities: 0,
      expiredEntities: 0
    };

    const registrations = this.registry.getAllRegistrations();

    for (const registration of registrations) {
      try {
        const entities = await this.getAll(registration.entityClass as any, guildId);
        const count = entities.length;

        stats.totalEntities += count;
        stats.entitiesByType[registration.storageKey] = count;

        if (registration.isPurgeable) {
          stats.purgeableEntities += count;
        }

        if (registration.isIdentified) {
          stats.identifiedEntities += count;
        }

        // Count temporary and expired entities
        const temporaryEntities = entities.filter(entity => EntityUtils.isTemporary(entity));
        stats.temporaryEntities += temporaryEntities.length;

        const expiredEntities = temporaryEntities.filter(entity => entity.isExpired());
        stats.expiredEntities += expiredEntities.length;

      } catch (error) {
        console.warn(`Failed to get stats for ${registration.storageKey}:`, error);
      }
    }

    return stats;
  }

  /**
   * Get cache statistics from the underlying repository
   */
  getCacheStats(): { hits: number; misses: number; evictions: number; size: number; hitRate: number } {
    return this.baseRepository.getCacheStats();
  }

  /**
   * Clear cache for a specific guild
   */
  clearGuildCache(guildId: string): void {
    this.baseRepository.clearGuildCache(guildId);
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.baseRepository.clearCache();
  }

  /**
   * Get the entity registry
   */
  getRegistry(): EntityRegistry {
    return this.registry;
  }
}

/**
 * Create an enhanced repository instance
 */
export function createEnhancedRepository(
  baseRepository?: Repository,
  registry?: EntityRegistry
): EnhancedRepository {
  return new EnhancedRepository(baseRepository, registry);
}

/**
 * Default enhanced repository instance
 */
export const enhancedRepository = new EnhancedRepository();