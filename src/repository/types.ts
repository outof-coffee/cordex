import { DatabaseObject, DatabaseCollection, Purgeable, IdentifiedEntity } from '../types.js';
import { EntityRegistry } from './registry.js';

export { DatabaseObject };
export { EntityRegistry, CollectionKeyExtractor, EntityRegistration } from './registry.js';

export interface RepositoryConfig {
  databasePath: string;
  entityRegistry?: EntityRegistry;
  enableCaching?: boolean;
  cacheTTL?: number;
  maxCacheSize?: number;
}

export interface Repository {
  initialize(config: RepositoryConfig): Promise<void>;
  isInitialized(): boolean;
  store<T extends DatabaseObject>(object: T): Promise<void>;
  storeUnique<T extends DatabaseObject & IdentifiedEntity>(
    object: T
  ): Promise<boolean>;
  storeCollection<T = any>(storageKey: string, collection: DatabaseCollection<T>): Promise<void>;
  getAll<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string
  ): Promise<T[]>;
  purgeStaleItems<T extends DatabaseObject & Purgeable>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    maxAgeHours?: number
  ): Promise<number>;
  replaceAll<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    objects: T[]
  ): Promise<void>;
  deleteById<T extends IdentifiedEntity>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    objectId: string
  ): Promise<boolean>;
  deleteUnique<T extends IdentifiedEntity>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    objectId: string
  ): Promise<boolean>;
  flushPendingWrites(): Promise<void>;

  // Advanced query functionality
  query<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    options?: QueryOptions<T>
  ): Promise<QueryResult<T>>;

  // Count entities with optional filtering
  count<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    collectionKey: string,
    filter?: (entity: T) => boolean
  ): Promise<number>;
}

// Internal repository types
export interface DatabaseData {
  [collectionKey: string]: {
    [storageKey: string]: DatabaseObject[] | DatabaseCollection<any>[];
  };
}

export interface PendingWrite {
  collectionKey: string;
  storageKey: string;
  data: DatabaseObject | DatabaseCollection<any>;
  resolve: () => void;
  reject: (error: Error) => void;
}

export interface PerformanceMetrics {
  totalWrites: number;
  batchedWrites: number;
  avgWriteTime: number;
  lastWriteTime: number;
}

// Query types for advanced repository operations
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