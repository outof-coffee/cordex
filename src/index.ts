/**
 * Discord bot database module exports
 * Handles data persistence using lowdb for Discord bot applications
 *
 * Main interface: Use the `repository` singleton for all Discord bot database operations
 */

// Main repository interface - use this for all Discord bot database operations
export {
  repository,
  Repository,
  RepositoryConfig,
  DatabaseObject,
  DatabaseRepository,
  QueryOptions,
  QueryResult,
  BulkOperationResult
} from './repository';

// Base types for creating Discord bot database entities
export { DatabaseEntity, DatabaseCollection, Purgeable, IdentifiedEntity } from './types';

// Discord-specific entity types and utilities
export {
  // Validation utilities
  isValidSnowflake,
  validateGuildId,
  validateUserId,
  validateChannelId,
  validateRoleId,

  // Base Discord entity class
  DiscordEntity,

  // Pre-built Discord entity types
  GuildConfig,
  GuildConfigData,
  GuildUser,
  GuildUserData,
  ChannelConfig,
  ChannelConfigData,
  RoleConfig,
  RoleConfigData,
  TempMute,
  TempMuteData,
  TempBan,
  TempBanData,
  Warning,
  WarningData,
  CommandUsage,
  CommandUsageData
} from './discord';

// Utility functions for conditional Discord slash command registration
export { isDatabaseEnabled, registerObject } from './register';

// Discord bot version utilities for command registration optimization
export { getBotVersion, shouldRegisterCommands } from './version-utils';
