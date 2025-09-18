import { DatabaseObjectConstructor } from './types';

/**
 * Object type registry for in-memory tracking of registered Discord bot object types
 */
const objectTypeRegistry = new Set<string>();

/**
 * Resets the object registry (for Discord bot testing only)
 * @internal
 */
export const resetDatabaseForTesting = (): void => {
  objectTypeRegistry.clear();
};

/**
 * Checks if the Discord bot database is enabled and properly initialized
 * @param databasePath - The database path from configuration, can be null
 * @returns True if database is enabled (path is not null) and repository is initialized, false otherwise
 */
export const isDatabaseEnabled = (databasePath: string | null): boolean => {
  if (databasePath === null) {
    return false;
  }
  
  // Import repository here to avoid circular dependency
  const { repository } = require('./repository');
  return repository.isInitialized();
};

/**
 * Registers a Discord bot object type for tracking (in-memory only)
 * @param objectClass - The class constructor that has a static storageKey property
 */
export const registerObject = (objectClass: DatabaseObjectConstructor): void => {
  objectTypeRegistry.add(objectClass.storageKey);
};
