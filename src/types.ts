export interface DatabaseObject {
  // Marker interface for database entities
  // Collection key is determined by EntityRegistry
}

export interface DatabaseObjectConstructor {
  readonly storageKey: string;
  new (...args: any[]): DatabaseObject;
}

export interface Purgeable {
  timestamp: string;
}

export interface IdentifiedEntity extends DatabaseObject {
  id: string;
}

export abstract class DatabaseEntity implements DatabaseObject {
  static readonly storageKey: string;
}

export interface DatabaseCollection<T = any> {
  getCollectionKey(): string;
  data: T[];
}

export interface DatabaseConfig {
  filePath: string;
}

export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  filePath: './data/db.json'
};