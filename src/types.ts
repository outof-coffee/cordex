export interface DatabaseObject {
  guildId: string;
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
  guildId: string;

  constructor(guildId: string) {
    this.guildId = guildId;
  }
}

export interface DatabaseCollection<T = any> {
  guildId: string;
  data: T[];
}

export interface DatabaseConfig {
  filePath: string;
}

export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  filePath: './data/db.json'
};