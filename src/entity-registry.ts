/**
 * Entity registration system for tracking and managing custom entity types
 * Provides metadata and discovery capabilities for bot entities
 */

import { DatabaseObject, DatabaseObjectConstructor } from './types';

/**
 * Metadata about a registered entity type
 */
export interface EntityRegistration {
  /** Unique storage key for the entity */
  storageKey: string;

  /** Constructor function for the entity */
  entityClass: DatabaseObjectConstructor;

  /** Human-readable name for the entity type */
  name: string;

  /** Description of what this entity represents */
  description: string;

  /** Whether this entity implements Purgeable interface */
  isPurgeable: boolean;

  /** Whether this entity implements IdentifiedEntity interface */
  isIdentified: boolean;

  /** Category for grouping related entities */
  category: string;

  /** Version of the entity schema */
  version: string;

  /** Tags for additional classification */
  tags: string[];

  /** When this entity type was registered */
  registeredAt: string;

  /** Additional metadata */
  metadata: Record<string, any>;
}

/**
 * Options for registering an entity
 */
export interface RegisterEntityOptions {
  /** Human-readable name (defaults to class name) */
  name?: string;

  /** Description of the entity */
  description?: string;

  /** Category for grouping (defaults to 'custom') */
  category?: string;

  /** Version of the entity schema (defaults to '1.0.0') */
  version?: string;

  /** Tags for classification */
  tags?: string[];

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Entity registry for managing and discovering entity types
 */
export class EntityRegistry {
  private entities = new Map<string, EntityRegistration>();
  private categories = new Map<string, Set<string>>();
  private tags = new Map<string, Set<string>>();

  /**
   * Register an entity type with metadata
   */
  register<T extends DatabaseObject>(
    entityClass: new (...args: any[]) => T,
    options: RegisterEntityOptions = {}
  ): EntityRegistration {
    const storageKey = (entityClass as any).storageKey;

    if (!storageKey) {
      throw new Error(`Entity class ${entityClass.name} must have a static storageKey property`);
    }

    if (this.entities.has(storageKey)) {
      throw new Error(`Entity with storage key '${storageKey}' is already registered`);
    }

    // Auto-detect entity capabilities
    const isPurgeable = this.implementsPurgeable(entityClass);
    const isIdentified = this.implementsIdentified(entityClass);

    const registration: EntityRegistration = {
      storageKey,
      entityClass: entityClass as unknown as DatabaseObjectConstructor,
      name: options.name || entityClass.name,
      description: options.description || `${entityClass.name} entity`,
      isPurgeable,
      isIdentified,
      category: options.category || 'custom',
      version: options.version || '1.0.0',
      tags: options.tags || [],
      registeredAt: new Date().toISOString(),
      metadata: options.metadata || {}
    };

    // Store registration
    this.entities.set(storageKey, registration);

    // Update category index
    if (!this.categories.has(registration.category)) {
      this.categories.set(registration.category, new Set());
    }
    this.categories.get(registration.category)!.add(storageKey);

    // Update tag indexes
    registration.tags.forEach(tag => {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }
      this.tags.get(tag)!.add(storageKey);
    });

    return registration;
  }

  /**
   * Unregister an entity type
   */
  unregister(storageKey: string): boolean {
    const registration = this.entities.get(storageKey);
    if (!registration) {
      return false;
    }

    // Remove from main registry
    this.entities.delete(storageKey);

    // Remove from category index
    const categorySet = this.categories.get(registration.category);
    if (categorySet) {
      categorySet.delete(storageKey);
      if (categorySet.size === 0) {
        this.categories.delete(registration.category);
      }
    }

    // Remove from tag indexes
    registration.tags.forEach(tag => {
      const tagSet = this.tags.get(tag);
      if (tagSet) {
        tagSet.delete(storageKey);
        if (tagSet.size === 0) {
          this.tags.delete(tag);
        }
      }
    });

    return true;
  }

  /**
   * Get registration info for an entity type
   */
  getRegistration(storageKey: string): EntityRegistration | undefined {
    return this.entities.get(storageKey);
  }

  /**
   * Get all registered entity types
   */
  getAllRegistrations(): EntityRegistration[] {
    return Array.from(this.entities.values());
  }

  /**
   * Get entity types by category
   */
  getByCategory(category: string): EntityRegistration[] {
    const storageKeys = this.categories.get(category);
    if (!storageKeys) {
      return [];
    }

    return Array.from(storageKeys)
      .map(key => this.entities.get(key)!)
      .filter(Boolean);
  }

  /**
   * Get entity types by tag
   */
  getByTag(tag: string): EntityRegistration[] {
    const storageKeys = this.tags.get(tag);
    if (!storageKeys) {
      return [];
    }

    return Array.from(storageKeys)
      .map(key => this.entities.get(key)!)
      .filter(Boolean);
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Get all tags
   */
  getTags(): string[] {
    return Array.from(this.tags.keys());
  }

  /**
   * Check if an entity type is registered
   */
  isRegistered(storageKey: string): boolean {
    return this.entities.has(storageKey);
  }

  /**
   * Get purgeable entity types
   */
  getPurgeableEntities(): EntityRegistration[] {
    return this.getAllRegistrations().filter(reg => reg.isPurgeable);
  }

  /**
   * Get identified entity types
   */
  getIdentifiedEntities(): EntityRegistration[] {
    return this.getAllRegistrations().filter(reg => reg.isIdentified);
  }

  /**
   * Search entity types by name or description
   */
  search(query: string): EntityRegistration[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllRegistrations().filter(reg =>
      reg.name.toLowerCase().includes(lowerQuery) ||
      reg.description.toLowerCase().includes(lowerQuery) ||
      reg.storageKey.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get entity statistics
   */
  getStats(): {
    totalEntities: number;
    purgeableEntities: number;
    identifiedEntities: number;
    categories: number;
    tags: number;
  } {
    const all = this.getAllRegistrations();

    return {
      totalEntities: all.length,
      purgeableEntities: all.filter(reg => reg.isPurgeable).length,
      identifiedEntities: all.filter(reg => reg.isIdentified).length,
      categories: this.categories.size,
      tags: this.tags.size
    };
  }

  /**
   * Export registry data for backup/sharing
   */
  export(): Record<string, EntityRegistration> {
    const result: Record<string, EntityRegistration> = {};
    for (const [key, registration] of this.entities) {
      result[key] = { ...registration };
    }
    return result;
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.entities.clear();
    this.categories.clear();
    this.tags.clear();
  }

  /**
   * Auto-detect if entity class implements Purgeable interface
   */
  private implementsPurgeable(entityClass: any): boolean {
    try {
      // Create a temporary instance to check for timestamp property
      const instance = Object.create(entityClass.prototype);
      return 'timestamp' in instance ||
             entityClass.prototype.hasOwnProperty('timestamp') ||
             this.classImplementsInterface(entityClass, 'timestamp');
    } catch {
      return false;
    }
  }

  /**
   * Auto-detect if entity class implements IdentifiedEntity interface
   */
  private implementsIdentified(entityClass: any): boolean {
    try {
      // Create a temporary instance to check for id property
      const instance = Object.create(entityClass.prototype);
      return 'id' in instance ||
             entityClass.prototype.hasOwnProperty('id') ||
             this.classImplementsInterface(entityClass, 'id');
    } catch {
      return false;
    }
  }

  /**
   * Check if class implements interface by checking for property
   */
  private classImplementsInterface(entityClass: any, propertyName: string): boolean {
    let current = entityClass.prototype;
    while (current) {
      if (current.hasOwnProperty(propertyName)) {
        return true;
      }
      current = Object.getPrototypeOf(current);
    }
    return false;
  }
}

/**
 * Global entity registry instance
 */
export const entityRegistry = new EntityRegistry();

/**
 * Decorator for automatically registering entity classes
 */
export function RegisterEntity(options: RegisterEntityOptions = {}) {
  return function<T extends DatabaseObjectConstructor>(target: T): T {
    // Register the entity after class definition
    setTimeout(() => {
      try {
        entityRegistry.register(target, options);
      } catch (error) {
        console.warn(`Failed to auto-register entity ${target.name}:`, error);
      }
    }, 0);

    return target;
  };
}

/**
 * Helper function for manual entity registration
 */
export function registerEntity<T extends DatabaseObject>(
  entityClass: new (...args: any[]) => T,
  options: RegisterEntityOptions = {}
): EntityRegistration {
  return entityRegistry.register(entityClass, options);
}

/**
 * Helper function to get entity registration
 */
export function getEntityRegistration(storageKey: string): EntityRegistration | undefined {
  return entityRegistry.getRegistration(storageKey);
}

/**
 * Helper function to check if entity is registered
 */
export function isEntityRegistered(storageKey: string): boolean {
  return entityRegistry.isRegistered(storageKey);
}

/**
 * Helper function to get all registrations
 */
export function getAllEntityRegistrations(): EntityRegistration[] {
  return entityRegistry.getAllRegistrations();
}

/**
 * Helper function to search entity types
 */
export function searchEntityTypes(query: string): EntityRegistration[] {
  return entityRegistry.search(query);
}