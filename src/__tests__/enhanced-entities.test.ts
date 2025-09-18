/**
 * Tests for enhanced entity base classes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PurgeableDiscordEntity,
  IdentifiedDiscordEntity,
  PurgeableIdentifiedDiscordEntity,
  UserDiscordEntity,
  ChannelDiscordEntity,
  TemporaryDiscordEntity,
  EventDiscordEntity,
  EntityUtils
} from '../enhanced-entities';

// Test entity implementations
class TestPurgeableEntity extends PurgeableDiscordEntity {
  static readonly storageKey = 'test-purgeable';
}

class TestIdentifiedEntity extends IdentifiedDiscordEntity {
  static readonly storageKey = 'test-identified';
}

class TestPurgeableIdentifiedEntity extends PurgeableIdentifiedDiscordEntity {
  static readonly storageKey = 'test-purgeable-identified';
}

class TestUserEntity extends UserDiscordEntity {
  static readonly storageKey = 'test-user';

  public readonly data: string;

  constructor(guildId: string, userId: string, data: string) {
    super(guildId, userId);
    this.data = data;
  }
}

class TestChannelEntity extends ChannelDiscordEntity {
  static readonly storageKey = 'test-channel';

  public readonly config: string;

  constructor(guildId: string, channelId: string, config: string) {
    super(guildId, channelId);
    this.config = config;
  }
}

class TestTemporaryEntity extends TemporaryDiscordEntity {
  static readonly storageKey = 'test-temporary';

  public readonly action: string;

  constructor(guildId: string, durationMs: number, action: string) {
    super(guildId, durationMs);
    this.action = action;
  }
}

class TestEventEntity extends EventDiscordEntity {
  static readonly storageKey = 'test-event';

  public readonly details: string;

  constructor(guildId: string, eventType: string, details: string, metadata: Record<string, any> = {}) {
    super(guildId, eventType, metadata);
    this.details = details;
  }
}

describe('Enhanced Entity Base Classes', () => {
  const testGuildId = '123456789012345678';
  const testUserId = '987654321098765432';
  const testChannelId = '111222333444555666';

  describe('PurgeableDiscordEntity', () => {
    it('should create with automatic timestamp', () => {
      const entity = new TestPurgeableEntity(testGuildId);

      expect(entity.guildId).toBe(testGuildId);
      expect(entity.timestamp).toBeDefined();
      expect(new Date(entity.timestamp)).toBeInstanceOf(Date);
    });

    it('should check if expired correctly', () => {
      const entity = new TestPurgeableEntity(testGuildId);

      expect(entity.isExpired(1)).toBe(false); // 1 hour
      // For 0 hours, we need to wait a tiny bit or use negative value
      expect(entity.isExpired(-1)).toBe(true); // Negative hours = already expired
    });

    it('should calculate age in hours', () => {
      const entity = new TestPurgeableEntity(testGuildId);
      const age = entity.getAgeHours();

      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(1); // Should be very recent
    });

    it('should have correct storage key', () => {
      expect(TestPurgeableEntity.storageKey).toBe('test-purgeable');
    });
  });

  describe('IdentifiedDiscordEntity', () => {
    it('should create with auto-generated ID', () => {
      const entity = new TestIdentifiedEntity(testGuildId);

      expect(entity.guildId).toBe(testGuildId);
      expect(entity.id).toBeDefined();
      expect(typeof entity.id).toBe('string');
      expect(entity.id.length).toBeGreaterThan(0);
    });

    it('should create with provided ID', () => {
      const customId = 'custom-id-123';
      const entity = new TestIdentifiedEntity(testGuildId, customId);

      expect(entity.id).toBe(customId);
    });

    it('should check ID correctly', () => {
      const customId = 'test-id';
      const entity = new TestIdentifiedEntity(testGuildId, customId);

      expect(entity.hasId('test-id')).toBe(true);
      expect(entity.hasId('other-id')).toBe(false);
    });

    it('should generate unique IDs', () => {
      const entity1 = new TestIdentifiedEntity(testGuildId);
      const entity2 = new TestIdentifiedEntity(testGuildId);

      expect(entity1.id).not.toBe(entity2.id);
    });
  });

  describe('PurgeableIdentifiedDiscordEntity', () => {
    it('should implement both interfaces', () => {
      const entity = new TestPurgeableIdentifiedEntity(testGuildId);

      expect(entity.guildId).toBe(testGuildId);
      expect(entity.id).toBeDefined();
      expect(entity.timestamp).toBeDefined();
    });

    it('should have all methods from both parent classes', () => {
      const entity = new TestPurgeableIdentifiedEntity(testGuildId, 'test-id');

      expect(entity.hasId('test-id')).toBe(true);
      expect(entity.isExpired(1)).toBe(false);
      expect(entity.getAgeHours()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('UserDiscordEntity', () => {
    it('should create with valid user ID', () => {
      const entity = new TestUserEntity(testGuildId, testUserId, 'test-data');

      expect(entity.guildId).toBe(testGuildId);
      expect(entity.userId).toBe(testUserId);
      expect(entity.id).toBeDefined();
      expect(entity.data).toBe('test-data');
    });

    it('should check user ownership correctly', () => {
      const entity = new TestUserEntity(testGuildId, testUserId, 'test');

      expect(entity.belongsToUser(testUserId)).toBe(true);
      expect(entity.belongsToUser('other-user')).toBe(false);
    });

    it('should throw on invalid user ID', () => {
      expect(() => new TestUserEntity(testGuildId, 'invalid-id', 'test')).toThrow();
    });

    it('should generate user-specific ID', () => {
      const entity = new TestUserEntity(testGuildId, testUserId, 'test');

      expect(entity.id).toContain(testUserId);
    });
  });

  describe('ChannelDiscordEntity', () => {
    it('should create with valid channel ID', () => {
      const entity = new TestChannelEntity(testGuildId, testChannelId, 'test-config');

      expect(entity.guildId).toBe(testGuildId);
      expect(entity.channelId).toBe(testChannelId);
      expect(entity.config).toBe('test-config');
    });

    it('should check channel ownership correctly', () => {
      const entity = new TestChannelEntity(testGuildId, testChannelId, 'test');

      expect(entity.belongsToChannel(testChannelId)).toBe(true);
      expect(entity.belongsToChannel('other-channel')).toBe(false);
    });

    it('should throw on invalid channel ID', () => {
      expect(() => new TestChannelEntity(testGuildId, 'invalid-id', 'test')).toThrow();
    });
  });

  describe('TemporaryDiscordEntity', () => {
    it('should create with expiration time', () => {
      const durationMs = 60000; // 1 minute
      const entity = new TestTemporaryEntity(testGuildId, durationMs, 'test-action');

      expect(entity.guildId).toBe(testGuildId);
      expect(entity.durationMs).toBe(durationMs);
      expect(entity.expiresAt).toBeDefined();
      expect(entity.action).toBe('test-action');
    });

    it('should check expiration correctly', () => {
      const shortDuration = new TestTemporaryEntity(testGuildId, 1, 'test'); // 1ms
      const longDuration = new TestTemporaryEntity(testGuildId, 60000, 'test'); // 1 minute

      // Wait a bit for the short one to expire
      setTimeout(() => {
        expect(shortDuration.isExpired()).toBe(true);
        expect(longDuration.isExpired()).toBe(false);
      }, 10);
    });

    it('should calculate remaining time', () => {
      const entity = new TestTemporaryEntity(testGuildId, 60000, 'test');
      const remaining = entity.getRemainingMs();

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(60000);
    });

    it('should format remaining time string', () => {
      const entity = new TestTemporaryEntity(testGuildId, 3661000, 'test'); // ~1 hour
      const timeString = entity.getRemainingTimeString();

      expect(timeString).toContain('h');
      expect(timeString).toContain('m');
      expect(timeString).toContain('s');
    });
  });

  describe('EventDiscordEntity', () => {
    it('should create with event type and metadata', () => {
      const metadata = { key1: 'value1', key2: 42 };
      const entity = new TestEventEntity(testGuildId, 'test-event', 'details', metadata);

      expect(entity.guildId).toBe(testGuildId);
      expect(entity.eventType).toBe('test-event');
      expect(entity.details).toBe('details');
      expect(entity.metadata).toEqual(metadata);
    });

    it('should check event type correctly', () => {
      const entity = new TestEventEntity(testGuildId, 'combat', 'battle details');

      expect(entity.isEventType('combat')).toBe(true);
      expect(entity.isEventType('trade')).toBe(false);
    });

    it('should get metadata values', () => {
      const entity = new TestEventEntity(testGuildId, 'test', 'details', { damage: 100, critical: true });

      expect(entity.getMetadata('damage')).toBe(100);
      expect(entity.getMetadata('critical')).toBe(true);
      expect(entity.getMetadata('missing')).toBeUndefined();
    });

    it('should check metadata existence', () => {
      const entity = new TestEventEntity(testGuildId, 'test', 'details', { existing: 'value' });

      expect(entity.hasMetadata('existing')).toBe(true);
      expect(entity.hasMetadata('missing')).toBe(false);
    });
  });

  describe('EntityUtils', () => {
    let purgeableEntity: TestPurgeableEntity;
    let identifiedEntity: TestIdentifiedEntity;
    let userEntity: TestUserEntity;
    let channelEntity: TestChannelEntity;
    let temporaryEntity: TestTemporaryEntity;
    let eventEntity: TestEventEntity;

    beforeEach(() => {
      purgeableEntity = new TestPurgeableEntity(testGuildId);
      identifiedEntity = new TestIdentifiedEntity(testGuildId);
      userEntity = new TestUserEntity(testGuildId, testUserId, 'test');
      channelEntity = new TestChannelEntity(testGuildId, testChannelId, 'test');
      temporaryEntity = new TestTemporaryEntity(testGuildId, 60000, 'test');
      eventEntity = new TestEventEntity(testGuildId, 'test', 'details');
    });

    it('should detect purgeable entities', () => {
      expect(EntityUtils.isPurgeable(purgeableEntity)).toBe(true);
      expect(EntityUtils.isPurgeable(identifiedEntity)).toBe(false);
      expect(EntityUtils.isPurgeable({})).toBe(false);
    });

    it('should detect identified entities', () => {
      expect(EntityUtils.isIdentified(identifiedEntity)).toBe(true);
      expect(EntityUtils.isIdentified(userEntity)).toBe(true);
      expect(EntityUtils.isIdentified(purgeableEntity)).toBe(false);
    });

    it('should detect user entities', () => {
      expect(EntityUtils.isUserEntity(userEntity)).toBe(true);
      expect(EntityUtils.isUserEntity(channelEntity)).toBe(false);
    });

    it('should detect channel entities', () => {
      expect(EntityUtils.isChannelEntity(channelEntity)).toBe(true);
      expect(EntityUtils.isChannelEntity(userEntity)).toBe(false);
    });

    it('should detect temporary entities', () => {
      expect(EntityUtils.isTemporary(temporaryEntity)).toBe(true);
      expect(EntityUtils.isTemporary(userEntity)).toBe(false);
    });

    it('should detect event entities', () => {
      expect(EntityUtils.isEvent(eventEntity)).toBe(true);
      expect(EntityUtils.isEvent(userEntity)).toBe(false);
    });

    it('should filter entities by type', () => {
      const entities = [userEntity, channelEntity, temporaryEntity];
      const userEntities = EntityUtils.filterByType(entities, EntityUtils.isUserEntity);
      const channelEntities = EntityUtils.filterByType(entities, EntityUtils.isChannelEntity);

      expect(userEntities).toHaveLength(1);
      expect(userEntities[0]).toBe(userEntity);
      expect(channelEntities).toHaveLength(1);
      expect(channelEntities[0]).toBe(channelEntity);
    });

    it('should get expired and fresh entities', () => {
      // Create entities with different timestamps
      const oldEntity = new TestPurgeableEntity(testGuildId);
      // Manually set old timestamp
      (oldEntity as any).timestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago

      const freshEntity = new TestPurgeableEntity(testGuildId);
      const entities = [oldEntity, freshEntity];

      const expired = EntityUtils.getExpired(entities, 1); // 1 hour max age
      const fresh = EntityUtils.getFresh(entities, 1);

      expect(expired).toHaveLength(1);
      expect(expired[0]).toBe(oldEntity);
      expect(fresh).toHaveLength(1);
      expect(fresh[0]).toBe(freshEntity);
    });
  });
});