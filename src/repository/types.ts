import { DatabaseObject, DatabaseCollection, Purgeable, IdentifiedEntity } from '../types';

export { DatabaseObject };

export interface RepositoryConfig {
  databasePath: string;
}

export interface Repository {
  initialize(config: RepositoryConfig): Promise<void>;
  isInitialized(): boolean;
  store<T extends DatabaseObject>(object: T): Promise<void>;
  storeCollection<T = any>(storageKey: string, collection: DatabaseCollection<T>): Promise<void>;
  getAll<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    guildId: string
  ): Promise<T[]>;
  purgeStaleItems<T extends DatabaseObject & Purgeable>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    maxAgeHours?: number
  ): Promise<number>;
  replaceAll<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    objects: T[]
  ): Promise<void>;
  deleteById<T extends IdentifiedEntity>(
    EntityClass: new (...args: any[]) => T,
    guildId: string,
    objectId: string
  ): Promise<boolean>;
  flushPendingWrites(): Promise<void>;
}

// Internal repository types
export interface DatabaseData {
  [guildId: string]: {
    [storageKey: string]: DatabaseObject[] | DatabaseCollection<any>[];
  };
}

export interface PendingWrite {
  guildId: string;
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