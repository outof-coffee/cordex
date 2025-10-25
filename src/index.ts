/**
 * Cordex - Core data management for Discord bots
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
  BulkOperationResult,
  EntityRegistry,
  CollectionKeyExtractor,
  EntityRegistration
} from './repository/index.js';

// Base types for creating Discord bot database entities
export { DatabaseEntity, DatabaseCollection, Purgeable, IdentifiedEntity } from './types.js';

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
} from './discord/index.js';

// Utility functions for conditional Discord slash command registration
export { isDatabaseEnabled, registerObject } from './register.js';

// Discord bot version utilities for command registration optimization
export { getBotVersion, shouldRegisterCommands } from './version-utils.js';
