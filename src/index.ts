/**
 * Discord bot database module exports
 * Handles data persistence using lowdb for Discord bot applications
 *
 * Main interface: Use the `repository` singleton for all Discord bot database operations
 */

// Main repository interface - use this for all Discord bot database operations
export { repository } from './repository';
export { Repository, RepositoryConfig } from './repository-types';

// Enhanced Discord repository with caching and validation
export { DiscordRepository, DiscordRepositoryConfig } from './discord-repository';

// Base types for creating Discord bot database entities
export { DatabaseObject, DatabaseEntity, DatabaseCollection, Purgeable, IdentifiedEntity } from './types';

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
} from './discord-entities';

// Utility functions for conditional Discord slash command registration
export { isDatabaseEnabled, registerObject } from './register';

// Discord bot version utilities for command registration optimization
export { getBotVersion, shouldRegisterCommands } from './version-utils';

// Enhanced entity base classes for custom bot development
export {
  PurgeableDiscordEntity,
  IdentifiedDiscordEntity,
  PurgeableIdentifiedDiscordEntity,
  UserDiscordEntity,
  ChannelDiscordEntity,
  TemporaryDiscordEntity,
  EventDiscordEntity,
  TypedDiscordEntity,
  EntityUtils,
  StorageKeyPattern
} from './enhanced-entities';

// Entity registration system
export {
  EntityRegistry,
  EntityRegistration,
  RegisterEntityOptions,
  RegisterEntity,
  registerEntity,
  getEntityRegistration,
  isEntityRegistered,
  getAllEntityRegistrations,
  searchEntityTypes,
  entityRegistry
} from './entity-registry';

// Enhanced repository with advanced query capabilities
export {
  EnhancedRepository,
  QueryOptions,
  QueryResult,
  BulkOperationResult,
  createEnhancedRepository,
  enhancedRepository
} from './enhanced-repository';
