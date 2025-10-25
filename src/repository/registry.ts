/**
 * Entity registry for mapping entity types to collection key extraction strategies
 */

import { DatabaseObject } from '../types.js';

/**
 * Function that extracts the collection key from an entity instance
 */
export type CollectionKeyExtractor<T> = (entity: T) => string;

/**
 * Registration information for an entity type
 */
export interface EntityRegistration<T extends DatabaseObject> {
  storageKey: string;
  getCollectionKey: CollectionKeyExtractor<T>;
}

/**
 * Registry for managing entity type registrations
 * Maps entity constructors to their storage configuration
 */
export class EntityRegistry {
  private registry = new Map<Function, EntityRegistration<any>>();

  /**
   * Register an entity type with its collection key extraction strategy
   *
   * @param EntityClass - The entity constructor
   * @param getCollectionKey - Function to extract collection key from entity instance
   *
   * @example
   * ```typescript
   * const registry = new EntityRegistry();
   *
   * // Guild-scoped entity
   * registry.register(GuildConfig, (entity) => entity.guildId);
   *
   * // User-scoped entity
   * registry.register(UserProfile, (entity) => entity.userId);
   *
   * // App-scoped entity
   * registry.register(BotSettings, () => 'app');
   * ```
   */
  register<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T,
    getCollectionKey: CollectionKeyExtractor<T>
  ): void {
    const storageKey = (EntityClass as any).storageKey;

    if (!storageKey) {
      throw new Error(
        `Entity class ${EntityClass.name} must have a static storageKey property`
      );
    }

    this.registry.set(EntityClass, {
      storageKey,
      getCollectionKey
    });
  }

  /**
   * Get registration information for an entity type
   *
   * @param EntityClass - The entity constructor
   * @returns Registration information or undefined if not registered
   */
  getRegistration<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T
  ): EntityRegistration<T> | undefined {
    return this.registry.get(EntityClass);
  }

  /**
   * Get registration information for an entity instance
   *
   * @param entity - The entity instance
   * @returns Registration information or undefined if not registered
   */
  getRegistrationForInstance<T extends DatabaseObject>(
    entity: T
  ): EntityRegistration<T> | undefined {
    return this.registry.get(entity.constructor);
  }

  /**
   * Check if an entity type is registered
   *
   * @param EntityClass - The entity constructor
   * @returns True if registered, false otherwise
   */
  isRegistered<T extends DatabaseObject>(
    EntityClass: new (...args: any[]) => T
  ): boolean {
    return this.registry.has(EntityClass);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.registry.clear();
  }
}
