/**
 * Enhanced entity base classes for custom bot development
 * Provides convenient base classes that combine common interfaces
 */

import { DiscordEntity, validateGuildId } from './discord-entities';
import { Purgeable, IdentifiedEntity } from './types';

/**
 * Base class for entities that need automatic purging based on age
 * Automatically sets timestamp on creation
 */
export abstract class PurgeableDiscordEntity extends DiscordEntity implements Purgeable {
  public readonly timestamp: string;

  constructor(guildId: string) {
    super(guildId);
    this.timestamp = new Date().toISOString();
  }

  /**
   * Check if this entity has expired based on age
   */
  public isExpired(maxAgeHours: number): boolean {
    const expirationTime = new Date();
    expirationTime.setHours(expirationTime.getHours() - maxAgeHours);
    return this.timestamp < expirationTime.toISOString();
  }

  /**
   * Get the age of this entity in hours
   */
  public getAgeHours(): number {
    const now = new Date();
    const created = new Date(this.timestamp);
    return (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  }
}

/**
 * Base class for entities that need ID-based operations
 * Provides automatic ID generation if not specified
 */
export abstract class IdentifiedDiscordEntity extends DiscordEntity implements IdentifiedEntity {
  public readonly id: string;

  constructor(guildId: string, id?: string) {
    super(guildId);
    this.id = id || this.generateId();
  }

  /**
   * Generate a unique ID for this entity
   * Override this method to customize ID generation
   */
  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if this entity has the specified ID
   */
  public hasId(id: string): boolean {
    return this.id === id;
  }
}

/**
 * Base class for entities that need both purging and ID-based operations
 * Combines both Purgeable and IdentifiedEntity interfaces
 */
export abstract class PurgeableIdentifiedDiscordEntity extends DiscordEntity implements Purgeable, IdentifiedEntity {
  public readonly id: string;
  public readonly timestamp: string;

  constructor(guildId: string, id?: string) {
    super(guildId);
    this.id = id || this.generateId();
    this.timestamp = new Date().toISOString();
  }

  /**
   * Generate a unique ID for this entity
   * Override this method to customize ID generation
   */
  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if this entity has expired based on age
   */
  public isExpired(maxAgeHours: number): boolean {
    const expirationTime = new Date();
    expirationTime.setHours(expirationTime.getHours() - maxAgeHours);
    return this.timestamp < expirationTime.toISOString();
  }

  /**
   * Get the age of this entity in hours
   */
  public getAgeHours(): number {
    const now = new Date();
    const created = new Date(this.timestamp);
    return (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Check if this entity has the specified ID
   */
  public hasId(id: string): boolean {
    return this.id === id;
  }
}

/**
 * Base class for user-associated entities
 * Entities that are tied to a specific Discord user within a guild
 */
export abstract class UserDiscordEntity extends IdentifiedDiscordEntity {
  public readonly userId: string;

  constructor(guildId: string, userId: string, id?: string) {
    // Validate user ID before calling super
    if (!/^\d{17,19}$/.test(userId)) {
      throw new Error(`Invalid Discord user ID format: ${userId}`);
    }

    super(guildId, id || `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`);
    validateGuildId(guildId);

    this.userId = userId;
  }

  /**
   * Check if this entity belongs to the specified user
   */
  public belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }

  /**
   * Generate user-specific ID if none provided
   */
  protected generateId(): string {
    return `${this.userId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }
}

/**
 * Base class for channel-associated entities
 * Entities that are tied to a specific Discord channel within a guild
 */
export abstract class ChannelDiscordEntity extends IdentifiedDiscordEntity {
  public readonly channelId: string;

  constructor(guildId: string, channelId: string, id?: string) {
    super(guildId, id);

    if (!/^\d{17,19}$/.test(channelId)) {
      throw new Error(`Invalid Discord channel ID format: ${channelId}`);
    }

    this.channelId = channelId;
  }

  /**
   * Check if this entity belongs to the specified channel
   */
  public belongsToChannel(channelId: string): boolean {
    return this.channelId === channelId;
  }

  /**
   * Generate channel-specific ID if none provided
   */
  protected generateId(): string {
    return `${this.channelId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }
}

/**
 * Base class for temporary entities with automatic expiration
 * Useful for temporary bans, mutes, or time-limited data
 */
export abstract class TemporaryDiscordEntity extends PurgeableIdentifiedDiscordEntity {
  public readonly expiresAt: string;
  public readonly durationMs: number;

  constructor(guildId: string, durationMs: number, id?: string) {
    super(guildId, id);
    this.durationMs = durationMs;

    const expirationDate = new Date();
    expirationDate.setMilliseconds(expirationDate.getMilliseconds() + durationMs);
    this.expiresAt = expirationDate.toISOString();
  }

  /**
   * Check if this temporary entity has expired
   */
  public isExpired(): boolean {
    return new Date().toISOString() > this.expiresAt;
  }

  /**
   * Get remaining time in milliseconds
   */
  public getRemainingMs(): number {
    const now = new Date().getTime();
    const expires = new Date(this.expiresAt).getTime();
    return Math.max(0, expires - now);
  }

  /**
   * Get remaining time in a human-readable format
   */
  public getRemainingTimeString(): string {
    const remainingMs = this.getRemainingMs();

    if (remainingMs === 0) {
      return 'Expired';
    }

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

/**
 * Base class for event-based entities
 * Entities that track events or activities with metadata
 */
export abstract class EventDiscordEntity extends PurgeableIdentifiedDiscordEntity {
  public readonly eventType: string;
  public readonly metadata: Record<string, any>;

  constructor(guildId: string, eventType: string, metadata: Record<string, any> = {}, id?: string) {
    super(guildId, id);
    this.eventType = eventType;
    this.metadata = { ...metadata };
  }

  /**
   * Check if this event is of the specified type
   */
  public isEventType(eventType: string): boolean {
    return this.eventType === eventType;
  }

  /**
   * Get metadata value by key
   */
  public getMetadata<T = any>(key: string): T | undefined {
    return this.metadata[key] as T;
  }

  /**
   * Check if metadata contains the specified key
   */
  public hasMetadata(key: string): boolean {
    return key in this.metadata;
  }
}

/**
 * Utility type for storage key validation
 * Ensures storage keys follow the pattern 'category-type'
 */
export type StorageKeyPattern = `${string}-${string}`;

/**
 * Enhanced typed entity base class
 * Provides compile-time storage key validation
 */
export abstract class TypedDiscordEntity extends DiscordEntity {
  static readonly storageKey: string;

  /**
   * Get the storage key for this entity type
   */
  public getStorageKey(): string {
    return (this.constructor as any).storageKey;
  }
}

/**
 * Utility functions for working with enhanced entities
 */
export class EntityUtils {
  /**
   * Check if an entity implements the Purgeable interface
   */
  static isPurgeable(entity: any): entity is Purgeable {
    return entity && typeof entity.timestamp === 'string';
  }

  /**
   * Check if an entity implements the IdentifiedEntity interface
   */
  static isIdentified(entity: any): entity is IdentifiedEntity {
    return entity && typeof entity.id === 'string';
  }

  /**
   * Check if an entity is user-associated
   */
  static isUserEntity(entity: any): entity is UserDiscordEntity {
    return entity instanceof UserDiscordEntity;
  }

  /**
   * Check if an entity is channel-associated
   */
  static isChannelEntity(entity: any): entity is ChannelDiscordEntity {
    return entity instanceof ChannelDiscordEntity;
  }

  /**
   * Check if an entity is temporary (has expiration)
   */
  static isTemporary(entity: any): entity is TemporaryDiscordEntity {
    return entity instanceof TemporaryDiscordEntity;
  }

  /**
   * Check if an entity is event-based
   */
  static isEvent(entity: any): entity is EventDiscordEntity {
    return entity instanceof EventDiscordEntity;
  }

  /**
   * Filter entities by type
   */
  static filterByType<T>(entities: any[], typeCheck: (entity: any) => entity is T): T[] {
    return entities.filter(typeCheck);
  }

  /**
   * Get expired entities from a collection
   */
  static getExpired<T extends Purgeable>(entities: T[], maxAgeHours: number): T[] {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);
    const cutoffTimestamp = cutoffTime.toISOString();

    return entities.filter(entity => entity.timestamp < cutoffTimestamp);
  }

  /**
   * Get non-expired entities from a collection
   */
  static getFresh<T extends Purgeable>(entities: T[], maxAgeHours: number): T[] {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);
    const cutoffTimestamp = cutoffTime.toISOString();

    return entities.filter(entity => entity.timestamp >= cutoffTimestamp);
  }
}