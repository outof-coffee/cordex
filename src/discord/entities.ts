/**
 * Discord-specific entity types for common Discord bot use cases
 * Extends the base database types with Discord-specific patterns and validations
 */

import { DatabaseEntity, IdentifiedEntity, Purgeable } from '../types';

/**
 * Validates if a string is a valid Discord Snowflake ID
 */
export const isValidSnowflake = (id: string): boolean => {
  return /^\d{17,19}$/.test(id);
};

/**
 * Validates Discord guild ID format
 */
export const validateGuildId = (guildId: string): void => {
  if (!isValidSnowflake(guildId)) {
    throw new Error(`Invalid Discord guild ID format: ${guildId}`);
  }
};

/**
 * Validates Discord user ID format
 */
export const validateUserId = (userId: string): void => {
  if (!isValidSnowflake(userId)) {
    throw new Error(`Invalid Discord user ID format: ${userId}`);
  }
};

/**
 * Validates Discord channel ID format
 */
export const validateChannelId = (channelId: string): void => {
  if (!isValidSnowflake(channelId)) {
    throw new Error(`Invalid Discord channel ID format: ${channelId}`);
  }
};

/**
 * Validates Discord role ID format
 */
export const validateRoleId = (roleId: string): void => {
  if (!isValidSnowflake(roleId)) {
    throw new Error(`Invalid Discord role ID format: ${roleId}`);
  }
};

/**
 * Discord-specific entity base class with enhanced validation
 * Stores guildId for Discord bot entities
 */
export abstract class DiscordEntity extends DatabaseEntity {
  public readonly guildId: string;

  constructor(guildId: string) {
    validateGuildId(guildId);
    super();
    this.guildId = guildId;
  }
}

/**
 * Guild configuration entity for storing per-guild bot settings
 */
export interface GuildConfigData {
  prefix: string;
  locale: string;
  timezone: string;
  features: string[];
  moderationEnabled: boolean;
  autoRoleEnabled: boolean;
}

export class GuildConfig extends DiscordEntity {
  static readonly storageKey = 'guild-configs';

  public readonly prefix: string;
  public readonly locale: string;
  public readonly timezone: string;
  public readonly features: string[];
  public readonly moderationEnabled: boolean;
  public readonly autoRoleEnabled: boolean;
  public readonly updatedAt: string;

  constructor(guildId: string, config: GuildConfigData) {
    super(guildId);
    this.prefix = config.prefix;
    this.locale = config.locale;
    this.timezone = config.timezone;
    this.features = [...config.features];
    this.moderationEnabled = config.moderationEnabled;
    this.autoRoleEnabled = config.autoRoleEnabled;
    this.updatedAt = new Date().toISOString();
  }
}

/**
 * Guild user data entity (user data scoped to specific guilds)
 */
export interface GuildUserData {
  username: string;
  displayName: string | undefined;
  joinedAt: string;
  roles: string[];
  experience: number;
  warnings: number;
  lastActiveAt: string | undefined;
}

export class GuildUser extends DiscordEntity implements IdentifiedEntity {
  static readonly storageKey = 'guild-users';

  public readonly id: string; // User ID
  public readonly username: string;
  public readonly displayName: string | undefined;
  public readonly joinedAt: string;
  public readonly roles: string[];
  public readonly experience: number;
  public readonly warnings: number;
  public readonly lastActiveAt: string | undefined;
  public readonly updatedAt: string;

  constructor(guildId: string, userId: string, userData: GuildUserData) {
    super(guildId);
    validateUserId(userId);

    this.id = userId;
    this.username = userData.username;
    this.displayName = userData.displayName;
    this.joinedAt = userData.joinedAt;
    this.roles = [...userData.roles];
    this.experience = userData.experience;
    this.warnings = userData.warnings;
    this.lastActiveAt = userData.lastActiveAt;
    this.updatedAt = new Date().toISOString();
  }
}

/**
 * Channel configuration entity for per-channel settings
 */
export interface ChannelConfigData {
  name: string;
  type: number; // Discord channel type
  autoModEnabled: boolean;
  slowModeSeconds: number;
  logChannelId: string | undefined;
  allowedRoles: string[];
  blockedUsers: string[];
}

export class ChannelConfig extends DiscordEntity implements IdentifiedEntity {
  static readonly storageKey = 'channel-configs';

  public readonly id: string; // Channel ID
  public readonly name: string;
  public readonly type: number;
  public readonly autoModEnabled: boolean;
  public readonly slowModeSeconds: number;
  public readonly logChannelId: string | undefined;
  public readonly allowedRoles: string[];
  public readonly blockedUsers: string[];
  public readonly updatedAt: string;

  constructor(guildId: string, channelId: string, config: ChannelConfigData) {
    super(guildId);
    validateChannelId(channelId);

    this.id = channelId;
    this.name = config.name;
    this.type = config.type;
    this.autoModEnabled = config.autoModEnabled;
    this.slowModeSeconds = config.slowModeSeconds;
    this.logChannelId = config.logChannelId;
    this.allowedRoles = [...config.allowedRoles];
    this.blockedUsers = [...config.blockedUsers];
    this.updatedAt = new Date().toISOString();
  }
}

/**
 * Role configuration entity for custom role behaviors
 */
export interface RoleConfigData {
  name: string;
  color: number;
  isAutoAssigned: boolean;
  requirements: string[];
  permissions: string[];
  hierarchyLevel: number;
}

export class RoleConfig extends DiscordEntity implements IdentifiedEntity {
  static readonly storageKey = 'role-configs';

  public readonly id: string; // Role ID
  public readonly name: string;
  public readonly color: number;
  public readonly isAutoAssigned: boolean;
  public readonly requirements: string[];
  public readonly permissions: string[];
  public readonly hierarchyLevel: number;
  public readonly updatedAt: string;

  constructor(guildId: string, roleId: string, config: RoleConfigData) {
    super(guildId);
    validateRoleId(roleId);

    this.id = roleId;
    this.name = config.name;
    this.color = config.color;
    this.isAutoAssigned = config.isAutoAssigned;
    this.requirements = [...config.requirements];
    this.permissions = [...config.permissions];
    this.hierarchyLevel = config.hierarchyLevel;
    this.updatedAt = new Date().toISOString();
  }
}

/**
 * Temporary mute entity with automatic expiration
 */
export interface TempMuteData {
  reason: string;
  durationMinutes: number;
  moderatorId: string;
  moderatorName: string;
}

export class TempMute extends DiscordEntity implements Purgeable, IdentifiedEntity {
  static readonly storageKey = 'temp-mutes';

  public readonly id: string; // User ID
  public readonly timestamp: string;
  public readonly reason: string;
  public readonly expiresAt: string;
  public readonly durationMinutes: number;
  public readonly moderatorId: string;
  public readonly moderatorName: string;

  constructor(guildId: string, userId: string, muteData: TempMuteData) {
    super(guildId);
    validateUserId(userId);
    validateUserId(muteData.moderatorId);

    this.id = userId;
    this.timestamp = new Date().toISOString();
    this.reason = muteData.reason;
    this.durationMinutes = muteData.durationMinutes;
    this.moderatorId = muteData.moderatorId;
    this.moderatorName = muteData.moderatorName;

    // Calculate expiration time
    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + muteData.durationMinutes);
    this.expiresAt = expirationDate.toISOString();
  }

  /**
   * Check if this mute has expired
   */
  public isExpired(): boolean {
    return new Date().toISOString() > this.expiresAt;
  }
}

/**
 * Temporary ban entity with automatic expiration
 */
export interface TempBanData {
  reason: string;
  durationHours: number;
  moderatorId: string;
  moderatorName: string;
  deleteMessageDays: number | undefined;
}

export class TempBan extends DiscordEntity implements Purgeable, IdentifiedEntity {
  static readonly storageKey = 'temp-bans';

  public readonly id: string; // User ID
  public readonly timestamp: string;
  public readonly reason: string;
  public readonly expiresAt: string;
  public readonly durationHours: number;
  public readonly moderatorId: string;
  public readonly moderatorName: string;
  public readonly deleteMessageDays: number;

  constructor(guildId: string, userId: string, banData: TempBanData) {
    super(guildId);
    validateUserId(userId);
    validateUserId(banData.moderatorId);

    this.id = userId;
    this.timestamp = new Date().toISOString();
    this.reason = banData.reason;
    this.durationHours = banData.durationHours;
    this.moderatorId = banData.moderatorId;
    this.moderatorName = banData.moderatorName;
    this.deleteMessageDays = banData.deleteMessageDays || 0;

    // Calculate expiration time
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + banData.durationHours);
    this.expiresAt = expirationDate.toISOString();
  }

  /**
   * Check if this ban has expired
   */
  public isExpired(): boolean {
    return new Date().toISOString() > this.expiresAt;
  }
}

/**
 * Warning entity for tracking user warnings
 */
export interface WarningData {
  reason: string;
  moderatorId: string;
  moderatorName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class Warning extends DiscordEntity implements Purgeable, IdentifiedEntity {
  static readonly storageKey = 'warnings';

  public readonly id: string; // Warning ID (generated)
  public readonly userId: string;
  public readonly timestamp: string;
  public readonly reason: string;
  public readonly moderatorId: string;
  public readonly moderatorName: string;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(guildId: string, userId: string, warningData: WarningData) {
    super(guildId);
    validateUserId(userId);
    validateUserId(warningData.moderatorId);

    this.id = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.userId = userId;
    this.timestamp = new Date().toISOString();
    this.reason = warningData.reason;
    this.moderatorId = warningData.moderatorId;
    this.moderatorName = warningData.moderatorName;
    this.severity = warningData.severity;
  }
}

/**
 * Command usage tracking entity
 */
export interface CommandUsageData {
  commandName: string;
  userId: string;
  username: string;
  channelId: string;
  success: boolean;
  executionTimeMs: number;
  error: string | undefined;
}

export class CommandUsage extends DiscordEntity implements Purgeable {
  static readonly storageKey = 'command-usage';

  public readonly timestamp: string;
  public readonly commandName: string;
  public readonly userId: string;
  public readonly username: string;
  public readonly channelId: string;
  public readonly success: boolean;
  public readonly executionTimeMs: number;
  public readonly error: string | undefined;

  constructor(guildId: string, usageData: CommandUsageData) {
    super(guildId);
    validateUserId(usageData.userId);
    validateChannelId(usageData.channelId);

    this.timestamp = new Date().toISOString();
    this.commandName = usageData.commandName;
    this.userId = usageData.userId;
    this.username = usageData.username;
    this.channelId = usageData.channelId;
    this.success = usageData.success;
    this.executionTimeMs = usageData.executionTimeMs;
    this.error = usageData.error;
  }
}