/**
 * Tests for Discord entity types and validation
 * Based on testing strategy recommendations from Marion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isValidSnowflake,
  validateGuildId,
  validateUserId,
  validateChannelId,
  validateRoleId,
  GuildConfig,
  GuildUser,
  ChannelConfig,
  TempMute,
  Warning,
  CommandUsage
} from '../discord/index.js';

describe('Discord ID Validation', () => {
  describe('isValidSnowflake', () => {
    it('should accept valid Discord snowflake IDs', () => {
      expect(isValidSnowflake('123456789012345678')).toBe(true);
      expect(isValidSnowflake('1234567890123456789')).toBe(true);
      expect(isValidSnowflake('12345678901234567')).toBe(true);
    });

    it('should reject invalid snowflake IDs', () => {
      expect(isValidSnowflake('')).toBe(false);
      expect(isValidSnowflake('123')).toBe(false);
      expect(isValidSnowflake('12345678901234567890')).toBe(false);
      expect(isValidSnowflake('abc123def456789012')).toBe(false);
      expect(isValidSnowflake('123456789012345678a')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isValidSnowflake(null as any)).toBe(false);
      expect(isValidSnowflake(undefined as any)).toBe(false);
    });
  });

  describe('validation functions', () => {
    const validId = '123456789012345678';
    const invalidId = 'invalid-id';

    it('should validate guild IDs correctly', () => {
      expect(() => validateGuildId(validId)).not.toThrow();
      expect(() => validateGuildId(invalidId)).toThrow('Invalid Discord guild ID format');
    });

    it('should validate user IDs correctly', () => {
      expect(() => validateUserId(validId)).not.toThrow();
      expect(() => validateUserId(invalidId)).toThrow('Invalid Discord user ID format');
    });

    it('should validate channel IDs correctly', () => {
      expect(() => validateChannelId(validId)).not.toThrow();
      expect(() => validateChannelId(invalidId)).toThrow('Invalid Discord channel ID format');
    });

    it('should validate role IDs correctly', () => {
      expect(() => validateRoleId(validId)).not.toThrow();
      expect(() => validateRoleId(invalidId)).toThrow('Invalid Discord role ID format');
    });
  });
});

describe('GuildConfig Entity', () => {
  const testGuildId = '123456789012345678';
  const testConfig = {
    prefix: '!',
    locale: 'en-US',
    timezone: 'UTC',
    features: ['moderation', 'autorole'],
    moderationEnabled: true,
    autoRoleEnabled: true
  };

  it('should create GuildConfig with valid data', () => {
    const config = new GuildConfig(testGuildId, testConfig);

    expect(config.guildId).toBe(testGuildId);
    expect(config.prefix).toBe(testConfig.prefix);
    expect(config.locale).toBe(testConfig.locale);
    expect(config.timezone).toBe(testConfig.timezone);
    expect(config.features).toEqual(testConfig.features);
    expect(config.moderationEnabled).toBe(testConfig.moderationEnabled);
    expect(config.autoRoleEnabled).toBe(testConfig.autoRoleEnabled);
    expect(config.updatedAt).toBeDefined();
  });

  it('should have correct storage key', () => {
    expect(GuildConfig.storageKey).toBe('guild-configs');
  });

  it('should throw on invalid guild ID', () => {
    expect(() => new GuildConfig('invalid', testConfig)).toThrow();
  });

  it('should copy features array to prevent mutations', () => {
    const originalFeatures = ['feature1', 'feature2'];
    const configData = { ...testConfig, features: originalFeatures };
    const config = new GuildConfig(testGuildId, configData);

    originalFeatures.push('feature3');
    expect(config.features).toEqual(['feature1', 'feature2']);
  });
});

describe('GuildUser Entity', () => {
  const testGuildId = '123456789012345678';
  const testUserId = '987654321098765432';
  const testUserData = {
    username: 'TestUser',
    displayName: 'Test User Display',
    joinedAt: '2024-01-01T00:00:00.000Z',
    roles: ['234567890123456789', '345678901234567890'],
    experience: 1000,
    warnings: 0,
    lastActiveAt: '2024-01-01T12:00:00.000Z'
  };

  it('should create GuildUser with valid data', () => {
    const user = new GuildUser(testGuildId, testUserId, testUserData);

    expect(user.guildId).toBe(testGuildId);
    expect(user.id).toBe(testUserId);
    expect(user.username).toBe(testUserData.username);
    expect(user.displayName).toBe(testUserData.displayName);
    expect(user.joinedAt).toBe(testUserData.joinedAt);
    expect(user.roles).toEqual(testUserData.roles);
    expect(user.experience).toBe(testUserData.experience);
    expect(user.warnings).toBe(testUserData.warnings);
    expect(user.lastActiveAt).toBe(testUserData.lastActiveAt);
    expect(user.updatedAt).toBeDefined();
  });

  it('should have correct storage key', () => {
    expect(GuildUser.storageKey).toBe('guild-users');
  });

  it('should throw on invalid guild ID', () => {
    expect(() => new GuildUser('invalid', testUserId, testUserData)).toThrow();
  });

  it('should throw on invalid user ID', () => {
    expect(() => new GuildUser(testGuildId, 'invalid', testUserData)).toThrow();
  });

  it('should copy roles array to prevent mutations', () => {
    const originalRoles = ['role1', 'role2'];
    const userData = { ...testUserData, roles: originalRoles };
    const user = new GuildUser(testGuildId, testUserId, userData);

    originalRoles.push('role3');
    expect(user.roles).toEqual(['role1', 'role2']);
  });
});

describe('ChannelConfig Entity', () => {
  const testGuildId = '123456789012345678';
  const testChannelId = '987654321098765432';
  const testConfig = {
    name: 'general',
    type: 0, // TEXT_CHANNEL
    autoModEnabled: true,
    slowModeSeconds: 5,
    logChannelId: '111222333444555666',
    allowedRoles: ['234567890123456789'],
    blockedUsers: ['345678901234567890']
  };

  it('should create ChannelConfig with valid data', () => {
    const config = new ChannelConfig(testGuildId, testChannelId, testConfig);

    expect(config.guildId).toBe(testGuildId);
    expect(config.id).toBe(testChannelId);
    expect(config.name).toBe(testConfig.name);
    expect(config.type).toBe(testConfig.type);
    expect(config.autoModEnabled).toBe(testConfig.autoModEnabled);
    expect(config.slowModeSeconds).toBe(testConfig.slowModeSeconds);
    expect(config.logChannelId).toBe(testConfig.logChannelId);
    expect(config.allowedRoles).toEqual(testConfig.allowedRoles);
    expect(config.blockedUsers).toEqual(testConfig.blockedUsers);
    expect(config.updatedAt).toBeDefined();
  });

  it('should have correct storage key', () => {
    expect(ChannelConfig.storageKey).toBe('channel-configs');
  });

  it('should throw on invalid channel ID', () => {
    expect(() => new ChannelConfig(testGuildId, 'invalid', testConfig)).toThrow();
  });
});

describe('TempMute Entity', () => {
  const testGuildId = '123456789012345678';
  const testUserId = '987654321098765432';
  const testModeratorId = '555666777888999000';
  const testMuteData = {
    reason: 'Spam',
    durationMinutes: 30,
    moderatorId: testModeratorId,
    moderatorName: 'ModeratorUser'
  };

  let mute: TempMute;

  beforeEach(() => {
    mute = new TempMute(testGuildId, testUserId, testMuteData);
  });

  it('should create TempMute with valid data', () => {
    expect(mute.guildId).toBe(testGuildId);
    expect(mute.id).toBe(testUserId);
    expect(mute.reason).toBe(testMuteData.reason);
    expect(mute.durationMinutes).toBe(testMuteData.durationMinutes);
    expect(mute.moderatorId).toBe(testMuteData.moderatorId);
    expect(mute.moderatorName).toBe(testMuteData.moderatorName);
    expect(mute.timestamp).toBeDefined();
    expect(mute.expiresAt).toBeDefined();
  });

  it('should have correct storage key', () => {
    expect(TempMute.storageKey).toBe('temp-mutes');
  });

  it('should implement Purgeable interface', () => {
    expect(mute.timestamp).toBeDefined();
    expect(typeof mute.timestamp).toBe('string');
  });

  it('should implement IdentifiedEntity interface', () => {
    expect(mute.id).toBeDefined();
    expect(typeof mute.id).toBe('string');
  });

  it('should calculate expiration time correctly', () => {
    const timestampDate = new Date(mute.timestamp);
    const expiresDate = new Date(mute.expiresAt);
    const diffMinutes = (expiresDate.getTime() - timestampDate.getTime()) / (1000 * 60);

    expect(Math.round(diffMinutes)).toBe(testMuteData.durationMinutes);
  });

  it('should check if mute is expired', () => {
    // Create a mute that should be expired
    const expiredMuteData = {
      ...testMuteData,
      durationMinutes: -1 // Negative duration to create expired mute
    };
    const expiredMute = new TempMute(testGuildId, testUserId, expiredMuteData);

    expect(expiredMute.isExpired()).toBe(true);
    expect(mute.isExpired()).toBe(false);
  });

  it('should throw on invalid moderator ID', () => {
    const invalidData = { ...testMuteData, moderatorId: 'invalid' };
    expect(() => new TempMute(testGuildId, testUserId, invalidData)).toThrow();
  });
});

describe('Warning Entity', () => {
  const testGuildId = '123456789012345678';
  const testUserId = '987654321098765432';
  const testModeratorId = '555666777888999000';
  const testWarningData = {
    reason: 'Inappropriate language',
    moderatorId: testModeratorId,
    moderatorName: 'ModeratorUser',
    severity: 'medium' as const
  };

  it('should create Warning with valid data', () => {
    const warning = new Warning(testGuildId, testUserId, testWarningData);

    expect(warning.guildId).toBe(testGuildId);
    expect(warning.userId).toBe(testUserId);
    expect(warning.reason).toBe(testWarningData.reason);
    expect(warning.moderatorId).toBe(testWarningData.moderatorId);
    expect(warning.moderatorName).toBe(testWarningData.moderatorName);
    expect(warning.severity).toBe(testWarningData.severity);
    expect(warning.timestamp).toBeDefined();
    expect(warning.id).toBeDefined();
  });

  it('should generate unique IDs', () => {
    const warning1 = new Warning(testGuildId, testUserId, testWarningData);
    const warning2 = new Warning(testGuildId, testUserId, testWarningData);

    expect(warning1.id).not.toBe(warning2.id);
  });

  it('should have correct storage key', () => {
    expect(Warning.storageKey).toBe('warnings');
  });

  it('should accept all severity levels', () => {
    const severityLevels = ['low', 'medium', 'high', 'critical'] as const;

    severityLevels.forEach(severity => {
      const warningData = { ...testWarningData, severity };
      const warning = new Warning(testGuildId, testUserId, warningData);
      expect(warning.severity).toBe(severity);
    });
  });
});

describe('CommandUsage Entity', () => {
  const testGuildId = '123456789012345678';
  const testUsageData = {
    commandName: 'test-command',
    userId: '987654321098765432',
    username: 'TestUser',
    channelId: '111222333444555666',
    success: true,
    executionTimeMs: 150,
    error: undefined as string | undefined
  };

  it('should create CommandUsage with valid data', () => {
    const usage = new CommandUsage(testGuildId, testUsageData);

    expect(usage.guildId).toBe(testGuildId);
    expect(usage.commandName).toBe(testUsageData.commandName);
    expect(usage.userId).toBe(testUsageData.userId);
    expect(usage.username).toBe(testUsageData.username);
    expect(usage.channelId).toBe(testUsageData.channelId);
    expect(usage.success).toBe(testUsageData.success);
    expect(usage.executionTimeMs).toBe(testUsageData.executionTimeMs);
    expect(usage.error).toBe(testUsageData.error);
    expect(usage.timestamp).toBeDefined();
  });

  it('should create CommandUsage with error', () => {
    const errorUsageData = {
      ...testUsageData,
      success: false,
      error: 'Command failed due to insufficient permissions'
    };

    const usage = new CommandUsage(testGuildId, errorUsageData);

    expect(usage.success).toBe(false);
    expect(usage.error).toBe(errorUsageData.error);
  });

  it('should have correct storage key', () => {
    expect(CommandUsage.storageKey).toBe('command-usage');
  });

  it('should throw on invalid user ID', () => {
    const invalidData = { ...testUsageData, userId: 'invalid', error: undefined as string | undefined };
    expect(() => new CommandUsage(testGuildId, invalidData)).toThrow();
  });

  it('should throw on invalid channel ID', () => {
    const invalidData = { ...testUsageData, channelId: 'invalid', error: undefined as string | undefined };
    expect(() => new CommandUsage(testGuildId, invalidData)).toThrow();
  });
});