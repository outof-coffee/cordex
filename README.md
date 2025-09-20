# Discord Wheel

Core library for data persistence per-guild in a Discord bot. Provides type-safe database operations using lowdb with JSON file storage, specifically designed for Discord bot development.

## Features

- **Guild-based data storage** - Isolated data per Discord server
- **Type-safe operations** - Full TypeScript support with strict typing
- **Repository pattern** - Clean, organized data access layer
- **Discord entity types** - Pre-built types for common Discord objects (users, channels, roles, etc.)
- **Conditional registration** - Utilities for optimized Discord slash command registration
- **Enhanced querying** - Advanced query capabilities with caching and validation
- **Version management** - Bot version utilities for command registration optimization

## Installation

```bash
npm install @outof-coffee/discord-wheel
```

## Quick Start

```typescript
import { repository, GuildConfig } from '@outof-coffee/discord-wheel';

// Initialize the repository
await repository.initialize({ databasePath: './data' });

// Create and save a guild configuration
const guildConfig = new GuildConfig({
  guildId: '123456789012345678',
  prefix: '!',
  welcomeChannel: '987654321098765432'
});

await repository.save(guildConfig);

// Load guild data
const config = await repository.load(GuildConfig, '123456789012345678');
```

## Core Components

### Repository
The main interface for all database operations:

```typescript
import { repository } from '@outof-coffee/discord-wheel';

// Save an entity
await repository.save(entity);

// Load an entity
const entity = await repository.load(EntityClass, id);

// Delete an entity
await repository.delete(EntityClass, id);
```

### Discord Entities
Pre-built entity types for common Discord bot use cases:

```typescript
import { GuildUser, ChannelConfig, TempMute } from '@outof-coffee/discord-wheel';

// User data per guild
const user = new GuildUser({
  guildId: '123456789012345678',
  userId: '987654321098765432',
  xp: 100,
  level: 5
});

// Channel configuration
const channelConfig = new ChannelConfig({
  guildId: '123456789012345678',
  channelId: '555666777888999000',
  isModChannel: true
});
```

### Enhanced Repository
Advanced querying with caching and validation:

```typescript
import { enhancedRepository } from '@outof-coffee/discord-wheel';

// Query with options
const results = await enhancedRepository.query(GuildUser, {
  where: { level: { $gte: 10 } },
  limit: 50,
  orderBy: 'xp',
  direction: 'desc'
});
```

## Entity Types

### Base Types
- `DiscordEntity` - Base class for Discord-related entities
- `DatabaseEntity` - Generic database entity interface
- `Purgeable` - Entities that can be bulk deleted
- `IdentifiedEntity` - Entities with unique identifiers

### Discord-Specific Entities
- `GuildConfig` - Server configuration settings
- `GuildUser` - User data per guild (XP, levels, etc.)
- `ChannelConfig` - Channel-specific settings
- `RoleConfig` - Role configuration data
- `TempMute` - Temporary mute records
- `TempBan` - Temporary ban records
- `Warning` - User warning system
- `CommandUsage` - Command usage tracking

### Enhanced Entity Classes
- `PurgeableDiscordEntity` - Entities that can be purged
- `IdentifiedDiscordEntity` - Discord entities with unique IDs
- `UserDiscordEntity` - User-specific Discord entities
- `ChannelDiscordEntity` - Channel-specific entities
- `TemporaryDiscordEntity` - Time-limited entities
- `EventDiscordEntity` - Event-based entities

## Utilities

### Command Registration
```typescript
import { isDatabaseEnabled, registerObject } from '@outof-coffee/discord-wheel';

// Conditional registration based on database state
if (isDatabaseEnabled()) {
  await registerObject(slashCommand);
}
```

### Version Management
```typescript
import { getBotVersion, shouldRegisterCommands } from '@outof-coffee/discord-wheel';

const version = getBotVersion();
if (shouldRegisterCommands(version)) {
  // Register slash commands
}
```

## Configuration

```typescript
import { repository, RepositoryConfig } from '@outof-coffee/discord-wheel';

const config: RepositoryConfig = {
  databasePath: './data',
  batchSize: 100,
  writeTimeout: 1000
};

await repository.initialize(config);
```

## Development

This library is built with TypeScript and uses:
- **lowdb v7.0.1** - JSON file-based database
- **Vitest** - Testing framework
- **TypeScript 5.8.3** - Type safety and modern JavaScript features

## License

MIT