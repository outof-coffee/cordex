# Cordex

Core data management library for Discord bots. Provides type-safe database operations using lowdb with JSON file storage and flexible entity registry system.

## Features

- **Flexible Collection Keys** - Store data by guild, user, or custom keys via Entity Registry
- **Type-safe Operations** - Full TypeScript support with strict typing
- **Repository Pattern** - Clean, organized data access layer
- **Discord Entity Types** - Pre-built types for common Discord objects
- **Write Batching** - Automatic batching with 50ms delay and 100-item batch sizes
- **Query API** - Advanced filtering, sorting, and pagination

## Installation

```bash
npm install @outof-coffee/cordex
```

## Quick Start

```typescript
import { EntityRegistry, repository, GuildConfig } from '@outof-coffee/cordex';

// Create and configure entity registry
const registry = new EntityRegistry();
registry.register(GuildConfig, (entity) => entity.guildId);

// Initialize repository with registry
await repository.initialize({
  databasePath: './data/bot-database.json',
  entityRegistry: registry
});

// Create and store a guild configuration
const guildConfig = new GuildConfig('123456789012345678', {
  prefix: '!',
  locale: 'en',
  timezone: 'UTC',
  features: [],
  moderationEnabled: true,
  autoRoleEnabled: false
});

await repository.store(guildConfig);

// Retrieve all configs for a guild
const configs = await repository.getAll(GuildConfig, '123456789012345678');
```

## Core Concepts

### Entity Registry

The Entity Registry maps entity types to collection key extraction strategies, giving you full control over how data is organized:

```typescript
const registry = new EntityRegistry();

// Guild-scoped storage (most common for Discord bots)
registry.register(GuildConfig, (entity) => entity.guildId);
registry.register(GuildUser, (entity) => entity.guildId);

// User-scoped storage (cross-guild data)
registry.register(UserProfile, (entity) => entity.userId);

// App-scoped storage (global singleton)
registry.register(BotSettings, () => 'app');
```

### Repository Operations

```typescript
import { repository } from '@outof-coffee/cordex';

// Store an entity
await repository.store(entity);

// Get all entities for a collection
const entities = await repository.getAll(EntityClass, collectionKey);

// Query with filtering and pagination
const result = await repository.query(EntityClass, collectionKey, {
  filter: (entity) => entity.level > 10,
  sort: (a, b) => b.experience - a.experience,
  limit: 10
});

// Delete by ID
await repository.deleteById(EntityClass, collectionKey, entityId);

// Replace all entities in a collection
await repository.replaceAll(EntityClass, collectionKey, newEntities);

// Purge stale items (for Purgeable entities)
await repository.purgeStaleItems(EntityClass, collectionKey, maxAgeHours);
```

## Entity Types

### Base Types

- `DatabaseObject` - Marker interface for all entities
- `DatabaseEntity` - Abstract base class with static `storageKey`
- `DiscordEntity` - Base class for Discord entities (includes `guildId` validation)
- `IdentifiedEntity` - Interface for entities with unique `id` property
- `Purgeable` - Interface for entities with `timestamp` (can be purged)

### Pre-built Discord Entities

- `GuildConfig` - Server configuration settings
- `GuildUser` - User data per guild
- `ChannelConfig` - Channel-specific settings
- `RoleConfig` - Role configuration data
- `TempMute` - Temporary mute records (Purgeable)
- `TempBan` - Temporary ban records (Purgeable)
- `Warning` - User warning system (Purgeable)
- `CommandUsage` - Command usage tracking (Purgeable)

## Creating Custom Entities

### Simple Guild-Scoped Entity

```typescript
import { DiscordEntity } from '@outof-coffee/cordex';

export class GuildSettings extends DiscordEntity {
  static readonly storageKey = 'guild-settings';

  constructor(
    guildId: string,
    public readonly welcomeMessage: string,
    public readonly logChannel: string
  ) {
    super(guildId);
  }
}

// Register it
registry.register(GuildSettings, (entity) => entity.guildId);
```

### User-Scoped Entity with ID

```typescript
import { DiscordEntity, IdentifiedEntity, validateUserId } from '@outof-coffee/cordex';

export class UserStats extends DiscordEntity implements IdentifiedEntity {
  static readonly storageKey = 'user-stats';

  public readonly id: string;

  constructor(
    guildId: string,
    userId: string,
    public readonly level: number,
    public readonly experience: number
  ) {
    super(guildId);
    validateUserId(userId);
    this.id = userId;
  }
}

// Register it
registry.register(UserStats, (entity) => entity.guildId);
```

## Configuration

```typescript
import { repository, RepositoryConfig } from '@outof-coffee/cordex';

const config: RepositoryConfig = {
  databasePath: './data/bot-database.json',
  entityRegistry: registry,  // Required
  enableCaching: true,        // Optional (default: true)
  cacheTTL: 60000,           // Optional (default: 60000ms)
  maxCacheSize: 1000         // Optional (default: 1000 entries)
};

await repository.initialize(config);
```

## Utilities

### Discord ID Validation

```typescript
import {
  isValidSnowflake,
  validateGuildId,
  validateUserId,
  validateChannelId,
  validateRoleId
} from '@outof-coffee/cordex';

// Check if valid
if (isValidSnowflake(id)) {
  // Valid Discord ID (17-19 digits)
}

// Validate (throws on invalid)
validateGuildId(guildId);
validateUserId(userId);
```

### Command Registration Helpers

```typescript
import { isDatabaseEnabled, registerObject } from '@outof-coffee/cordex';

// Check if database is initialized
if (isDatabaseEnabled()) {
  await registerObject(slashCommand);
}
```

### Version Management

```typescript
import { getBotVersion, shouldRegisterCommands } from '@outof-coffee/cordex';

const version = getBotVersion();
if (shouldRegisterCommands(version)) {
  // Register slash commands
}
```

## Advanced Features

### Write Batching

Cordex automatically batches writes for performance:
- **Batch Delay**: 50ms (writes are collected for 50ms before flushing)
- **Batch Size**: Up to 100 items per batch
- **Manual Flush**: `await repository.flushPendingWrites()`

### Query API

```typescript
const result = await repository.query(UserStats, guildId, {
  filter: (stats) => stats.level >= 10,
  sort: (a, b) => b.experience - a.experience,
  limit: 10,
  offset: 0
});

console.log(result.entities);      // Matching entities
console.log(result.totalCount);    // Total before pagination
console.log(result.hasMore);       // Are there more results?
console.log(result.executionTimeMs); // Query execution time
```

### Purging Stale Data

For entities implementing `Purgeable`:

```typescript
// Remove items older than 24 hours
const removedCount = await repository.purgeStaleItems(
  TempMute,
  guildId,
  24  // maxAgeHours
);
```

## Examples

See the complete example bot at `examples/discord-bot/` which demonstrates:
- Entity Registry setup
- Custom entities
- Repository operations
- Both slash and prefix commands

## Development

This library is built with TypeScript and uses:
- **lowdb v7.0.1** - JSON file-based database
- **Vitest v4** - Testing framework
- **TypeScript 5.9** - Type safety and modern JavaScript features

## License

MIT
