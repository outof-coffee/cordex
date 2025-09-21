/**
 * Tests for Discord repository with caching and validation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DiscordRepository, DiscordRepositoryConfig, GuildConfig, GuildUser, TempMute } from '../discord';
import { Repository } from '../repository-types';

// Mock base repository
const mockBaseRepository: Repository = {
  initialize: vi.fn(),
  isInitialized: vi.fn(() => true),
  store: vi.fn(),
  storeCollection: vi.fn(),
  getAll: vi.fn(),
  replaceAll: vi.fn(),
  deleteById: vi.fn(),
  purgeStaleItems: vi.fn(),
  flushPendingWrites: vi.fn()
};

describe('DiscordRepository', () => {
  let repository: DiscordRepository;
  const testConfig: DiscordRepositoryConfig = {
    databasePath: './test-db.json',
    enableCaching: true,
    cacheTTL: 1000, // 1 second for testing
    maxCacheSize: 10,
    validateDiscordIds: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new DiscordRepository(mockBaseRepository);
  });

  afterEach(() => {
    repository.clearCache();
  });

  describe('initialization', () => {
    it('should initialize with config', async () => {
      await repository.initialize(testConfig);
      expect(mockBaseRepository.initialize).toHaveBeenCalledWith(testConfig);
    });

    it('should use default config values', async () => {
      const minimalConfig = { databasePath: './test.json' };
      await repository.initialize(minimalConfig);

      // The config object passed to base repository should include all defaults
      expect(mockBaseRepository.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          databasePath: './test.json',
          enableCaching: true,
          cacheTTL: 5 * 60 * 1000,
          maxCacheSize: 1000,
          validateDiscordIds: true
        })
      );
    });

    it('should check initialization status', async () => {
      expect(repository.isInitialized()).toBe(true);
      expect(mockBaseRepository.isInitialized).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    beforeEach(async () => {
      await repository.initialize(testConfig);
    });

    it('should validate Discord IDs when storing entities', async () => {
      const validGuildId = '123456789012345678';
      const testConfig = {
        prefix: '!',
        locale: 'en-US',
        timezone: 'UTC',
        features: [],
        moderationEnabled: true,
        autoRoleEnabled: false
      };

      const guildConfig = new GuildConfig(validGuildId, testConfig);

      await expect(repository.store(guildConfig)).resolves.not.toThrow();
      expect(mockBaseRepository.store).toHaveBeenCalledWith(guildConfig);
    });

    it('should throw on invalid guild ID', async () => {
      const invalidGuildId = 'invalid-guild-id';
      const testConfig = {
        prefix: '!',
        locale: 'en-US',
        timezone: 'UTC',
        features: [],
        moderationEnabled: true,
        autoRoleEnabled: false
      };

      expect(() => new GuildConfig(invalidGuildId, testConfig)).toThrow('Invalid Discord guild ID format');
    });

    it('should validate entity with Discord ID fields', async () => {
      const validGuildId = '123456789012345678';
      const validUserId = '987654321098765432';
      const validModeratorId = '555666777888999000';

      const muteData = {
        reason: 'Test',
        durationMinutes: 30,
        moderatorId: validModeratorId,
        moderatorName: 'TestMod'
      };

      const tempMute = new TempMute(validGuildId, validUserId, muteData);

      await expect(repository.store(tempMute)).resolves.not.toThrow();
      expect(mockBaseRepository.store).toHaveBeenCalledWith(tempMute);
    });

    it('should skip validation when disabled', async () => {
      const configWithoutValidation = {
        ...testConfig,
        validateDiscordIds: false
      };

      await repository.initialize(configWithoutValidation);

      // This would normally throw, but validation is disabled
      const mockEntity = {
        guildId: 'invalid-id',
        constructor: { storageKey: 'test' }
      } as any;

      await expect(repository.store(mockEntity)).resolves.not.toThrow();
    });
  });

  describe('caching', () => {
    beforeEach(async () => {
      await repository.initialize(testConfig);
    });

    it('should cache getAll results', async () => {
      const testGuildId = '123456789012345678';
      const mockResults = [new GuildConfig(testGuildId, {
        prefix: '!',
        locale: 'en-US',
        timezone: 'UTC',
        features: [],
        moderationEnabled: true,
        autoRoleEnabled: false
      })];

      (mockBaseRepository.getAll as any).mockResolvedValue(mockResults);

      // First call - should hit database
      const result1 = await repository.getAll(GuildConfig, testGuildId);
      expect(result1).toBe(mockResults);
      expect(mockBaseRepository.getAll).toHaveBeenCalledTimes(1);

      // Second call - should hit cache
      const result2 = await repository.getAll(GuildConfig, testGuildId);
      expect(result2).toBe(mockResults);
      expect(mockBaseRepository.getAll).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should cache getById results', async () => {
      const testGuildId = '123456789012345678';
      const testUserId = '987654321098765432';

      const mockUser = new GuildUser(testGuildId, testUserId, {
        username: 'TestUser',
        displayName: undefined,
        joinedAt: '2024-01-01T00:00:00.000Z',
        roles: [],
        experience: 0,
        warnings: 0,
        lastActiveAt: undefined
      });

      (mockBaseRepository.getAll as any).mockResolvedValue([mockUser]);

      // First call
      const result1 = await repository.getById(GuildUser, testGuildId, testUserId);
      expect(result1).toBe(mockUser);

      // Second call - should hit cache
      const result2 = await repository.getById(GuildUser, testGuildId, testUserId);
      expect(result2).toBe(mockUser);
      expect(mockBaseRepository.getAll).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache on store operations', async () => {
      const testGuildId = '123456789012345678';
      const mockResults: GuildConfig[] = [];

      (mockBaseRepository.getAll as any).mockResolvedValue(mockResults);

      // Fill cache
      await repository.getAll(GuildConfig, testGuildId);
      expect(mockBaseRepository.getAll).toHaveBeenCalledTimes(1);

      // Store new entity - should invalidate cache
      const newConfig = new GuildConfig(testGuildId, {
        prefix: '!',
        locale: 'en-US',
        timezone: 'UTC',
        features: [],
        moderationEnabled: true,
        autoRoleEnabled: false
      });

      await repository.store(newConfig);

      // Next getAll should hit database again
      await repository.getAll(GuildConfig, testGuildId);
      expect(mockBaseRepository.getAll).toHaveBeenCalledTimes(2);
    });

    it('should respect cache TTL', async () => {
      // Use short TTL for testing
      const shortTTLConfig = { ...testConfig, cacheTTL: 10 }; // 10ms
      await repository.initialize(shortTTLConfig);

      const testGuildId = '123456789012345678';
      const mockResults: GuildConfig[] = [];

      (mockBaseRepository.getAll as any).mockResolvedValue(mockResults);

      // First call
      await repository.getAll(GuildConfig, testGuildId);
      expect(mockBaseRepository.getAll).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 20));

      // Second call - cache expired, should hit database
      await repository.getAll(GuildConfig, testGuildId);
      expect(mockBaseRepository.getAll).toHaveBeenCalledTimes(2);
    });

    it('should provide cache statistics', async () => {
      const testGuildId = '123456789012345678';
      (mockBaseRepository.getAll as any).mockResolvedValue([]);

      const initialStats = repository.getCacheStats();
      expect(initialStats.hits).toBe(0);
      expect(initialStats.misses).toBe(0);
      expect(initialStats.size).toBe(0);
      expect(initialStats.hitRate).toBe(0);

      // Miss
      await repository.getAll(GuildConfig, testGuildId);

      // Hit
      await repository.getAll(GuildConfig, testGuildId);

      const stats = repository.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(1);
      expect(stats.hitRate).toBe(50);
    });

    it('should clear guild-specific cache', async () => {
      const guild1 = '123456789012345678';
      const guild2 = '876543210987654321';

      (mockBaseRepository.getAll as any).mockResolvedValue([]);

      // Cache data for both guilds
      await repository.getAll(GuildConfig, guild1);
      await repository.getAll(GuildConfig, guild2);

      expect(repository.getCacheStats().size).toBe(2);

      // Clear cache for guild1 only
      repository.clearGuildCache(guild1);

      // Guild1 should hit database, guild2 should hit cache
      await repository.getAll(GuildConfig, guild1);
      await repository.getAll(GuildConfig, guild2);

      expect(mockBaseRepository.getAll).toHaveBeenCalledTimes(3); // 2 initial + 1 after clear
    });

    it('should disable caching when configured', async () => {
      const noCacheConfig = { ...testConfig, enableCaching: false };
      await repository.initialize(noCacheConfig);

      const testGuildId = '123456789012345678';
      (mockBaseRepository.getAll as any).mockResolvedValue([]);

      // Multiple calls should always hit database
      await repository.getAll(GuildConfig, testGuildId);
      await repository.getAll(GuildConfig, testGuildId);

      expect(mockBaseRepository.getAll).toHaveBeenCalledTimes(2);

      // When caching is disabled, stats should remain at 0
      const stats = repository.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0); // No cache operations = no misses tracked
    });
  });

  describe('bulk operations', () => {
    beforeEach(async () => {
      await repository.initialize(testConfig);
    });

    it('should handle bulk store operations', async () => {
      const guild1 = '123456789012345678';
      const guild2 = '876543210987654321';

      const entities = [
        new GuildConfig(guild1, {
          prefix: '!',
          locale: 'en-US',
          timezone: 'UTC',
          features: [],
          moderationEnabled: true,
          autoRoleEnabled: false
        }),
        new GuildConfig(guild2, {
          prefix: '$',
          locale: 'en-UK',
          timezone: 'GMT',
          features: ['premium'],
          moderationEnabled: false,
          autoRoleEnabled: true
        })
      ];

      await repository.bulkStore(entities);

      expect(mockBaseRepository.store).toHaveBeenCalledTimes(2);
      expect(mockBaseRepository.store).toHaveBeenCalledWith(entities[0]);
      expect(mockBaseRepository.store).toHaveBeenCalledWith(entities[1]);
    });

    it('should handle empty bulk operations', async () => {
      await repository.bulkStore([]);
      expect(mockBaseRepository.store).not.toHaveBeenCalled();
    });

    it('should validate all entities in bulk operations', async () => {
      const validGuild = '123456789012345678';
      const entities = [
        new GuildConfig(validGuild, {
          prefix: '!',
          locale: 'en-US',
          timezone: 'UTC',
          features: [],
          moderationEnabled: true,
          autoRoleEnabled: false
        })
      ];

      // Mock invalid entity (would fail validation if it were a real entity)
      const invalidEntity = {
        guildId: 'invalid-id',
        constructor: { storageKey: 'test' }
      } as any;

      // Should validate each entity and throw on first invalid one
      const mixedEntities = [entities[0], invalidEntity];

      await expect(repository.bulkStore(mixedEntities)).rejects.toThrow();
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      await repository.initialize(testConfig);
    });

    it('should count entities', async () => {
      const testGuildId = '123456789012345678';
      const mockEntities = [
        new GuildConfig(testGuildId, {
          prefix: '!',
          locale: 'en-US',
          timezone: 'UTC',
          features: [],
          moderationEnabled: true,
          autoRoleEnabled: false
        })
      ];

      (mockBaseRepository.getAll as any).mockResolvedValue(mockEntities);

      const count = await repository.count(GuildConfig, testGuildId);
      expect(count).toBe(1);
    });

    it('should check entity existence', async () => {
      const testGuildId = '123456789012345678';
      const testUserId = '987654321098765432';

      const mockUser = new GuildUser(testGuildId, testUserId, {
        username: 'TestUser',
        displayName: undefined,
        joinedAt: '2024-01-01T00:00:00.000Z',
        roles: [],
        experience: 0,
        warnings: 0,
        lastActiveAt: undefined
      });

      (mockBaseRepository.getAll as any).mockResolvedValue([mockUser]);

      const exists = await repository.exists(GuildUser, testGuildId, testUserId);
      expect(exists).toBe(true);

      const notExists = await repository.exists(GuildUser, testGuildId, 'nonexistent');
      expect(notExists).toBe(false);
    });

    it('should get entities by field value', async () => {
      const testGuildId = '123456789012345678';
      const mockUsers = [
        new GuildUser(testGuildId, '111111111111111111', {
          username: 'User1',
          displayName: undefined,
          joinedAt: '2024-01-01T00:00:00.000Z',
          roles: [],
          experience: 100,
          warnings: 0,
          lastActiveAt: undefined
        }),
        new GuildUser(testGuildId, '222222222222222222', {
          username: 'User2',
          displayName: undefined,
          joinedAt: '2024-01-01T00:00:00.000Z',
          roles: [],
          experience: 100,
          warnings: 1,
          lastActiveAt: undefined
        })
      ];

      (mockBaseRepository.getAll as any).mockResolvedValue(mockUsers);

      const usersWithExperience100 = await repository.getByField(
        GuildUser,
        testGuildId,
        'experience',
        100
      );

      expect(usersWithExperience100).toHaveLength(2);

      const usersWithWarnings = await repository.getByField(
        GuildUser,
        testGuildId,
        'warnings',
        1
      );

      expect(usersWithWarnings).toHaveLength(1);
      expect(usersWithWarnings[0].id).toBe('222222222222222222');
    });
  });
});