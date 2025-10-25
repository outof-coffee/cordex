# Creating Custom Entities

This guide shows you how to create custom entities for your Discord bot using Cordex.

## Understanding Collection Keys

Collection keys determine **where** your entities are stored in the database. The database is organized like this:

```
{
  "guild-123": {
    "user-stats": [...],
    "guild-configs": [...]
  },
  "guild-456": {
    "user-stats": [...],
    "guild-configs": [...]
  },
  "user-789": {
    "user-profiles": [...]
  }
}
```

The collection key (like `"guild-123"` or `"user-789"`) is the top-level key. This isolates data by context.

**Important:** Entities often store the same value used as the collection key (like `guildId` or `userId`) because:
1. **For storage**: The registry uses it to determine where to store the entity
2. **For your code**: You need it when working with the entity after retrieval

For example, a `UserStats` entity stores `guildId` so you know which guild the stats belong to, and the registry extracts `guildId` to store it in that guild's collection.

## Setting Up Entity Registry

The Entity Registry maps entity types to collection key extraction strategies. You must create and configure a registry before using the repository.

```typescript
import { EntityRegistry, repository } from '@outof-coffee/cordex';

// Create registry
const registry = new EntityRegistry();

// Register entities with collection key extractors
registry.register(GuildConfig, (entity) => entity.guildId);  // Guild-scoped
registry.register(UserStats, (entity) => entity.guildId);    // Guild-scoped
registry.register(UserProfile, (entity) => entity.userId);   // User-scoped
registry.register(BotSettings, () => 'app');                 // App-scoped (singleton)

// Initialize repository with registry
await repository.initialize({
  databasePath: './data/bot-database.json',
  entityRegistry: registry
});
```

**The registry is required.** The repository will throw an error if you try to store an entity without a registry.

---

## Basic Guild Configuration Entity

A simple entity for guild-wide settings:

```typescript
import { DiscordEntity } from '@outof-coffee/cordex';

interface GuildConfigData {
  prefix: string;
  enableFeatures: boolean;
  welcomeMessage?: string;
}

export class GuildConfig extends DiscordEntity {
  static readonly storageKey = 'guild-configs';

  public readonly prefix: string;
  public readonly enableFeatures: boolean;
  public readonly welcomeMessage?: string;
  public readonly updatedAt: string;

  constructor(guildId: string, data: GuildConfigData) {
    super(guildId);

    this.prefix = data.prefix;
    this.enableFeatures = data.enableFeatures;
    this.welcomeMessage = data.welcomeMessage;
    this.updatedAt = new Date().toISOString();
  }
}
```

**Register with guild-scoped collection key:**

```typescript
registry.register(GuildConfig, (entity) => entity.guildId);
```

This stores each guild's config separately: `db["guild-123"]["guild-configs"]`

**Key points:**
- Extends `DiscordEntity` for Discord ID validation
- Stores `guildId` as data property
- Registry extracts `guildId` for collection key
- One config per guild

---

## User Data Entity with IdentifiedEntity

Entity for tracking user data with unique IDs:

```typescript
import { DiscordEntity, validateUserId, IdentifiedEntity } from '@outof-coffee/cordex';

interface UserStatsData {
  level: number;
  experience: number;
  lastActive: string;
}

export class UserStats extends DiscordEntity implements IdentifiedEntity {
  static readonly storageKey = 'user-stats';

  public readonly id: string;
  public readonly userId: string;
  public readonly username: string;
  public readonly level: number;
  public readonly experience: number;
  public readonly lastActive: string;

  constructor(guildId: string, userId: string, username: string, data: UserStatsData) {
    super(guildId);
    validateUserId(userId);

    this.id = userId;
    this.userId = userId;
    this.username = username;
    this.level = data.level;
    this.experience = data.experience;
    this.lastActive = data.lastActive;
  }

  // Helper method to create updated version
  public addExperience(amount: number): UserStats {
    const newExp = this.experience + amount;
    const newLevel = Math.floor(newExp / 100) + 1;

    return new UserStats(this.guildId, this.userId, this.username, {
      level: newLevel,
      experience: newExp,
      lastActive: new Date().toISOString()
    });
  }
}
```

**Register with guild-scoped collection key:**

```typescript
registry.register(UserStats, (entity) => entity.guildId);
```

This stores user stats per guild: `db["guild-123"]["user-stats"]` contains all users in that guild.

**Key points:**
- Implements `IdentifiedEntity` interface (requires `id` property)
- Uses `id = userId` for user-based lookups
- Stores both `guildId` and `userId`
- Multiple user records per guild
- Immutable pattern: methods return new instances

---

## Entity with Expiration

Entities that track their own expiration:

```typescript
import { DiscordEntity, IdentifiedEntity, validateUserId } from '@outof-coffee/cordex';

export class TempBoost extends DiscordEntity implements IdentifiedEntity {
  static readonly storageKey = 'temp-boosts';

  public readonly id: string;
  public readonly userId: string;
  public readonly boostType: string;
  public readonly expiresAt: string;
  public readonly createdAt: string;

  constructor(guildId: string, userId: string, boostType: string, durationMs: number) {
    super(guildId);
    validateUserId(userId);

    this.id = `${userId}-${Date.now()}`;
    this.userId = userId;
    this.boostType = boostType;
    this.createdAt = new Date().toISOString();

    const expirationDate = new Date();
    expirationDate.setMilliseconds(expirationDate.getMilliseconds() + durationMs);
    this.expiresAt = expirationDate.toISOString();
  }

  public isExpired(): boolean {
    return new Date().toISOString() > this.expiresAt;
  }
}
```

**Register:**

```typescript
registry.register(TempBoost, (entity) => entity.guildId);
```

**Use with repository:**

```typescript
// Get only active boosts
const allBoosts = await repository.getAll(TempBoost, guildId);
const activeBoosts = allBoosts.filter(b => !b.isExpired());

// Or use query
const result = await repository.query(TempBoost, guildId, {
  filter: (boost) => !boost.isExpired()
});
```

---

## Entity with Channel Association

Entities tied to specific channels:

```typescript
import { DiscordEntity, IdentifiedEntity, validateChannelId } from '@outof-coffee/cordex';

interface ChannelSettingsData {
  allowCommands: boolean;
  slowMode: number;
}

export class ChannelSettings extends DiscordEntity implements IdentifiedEntity {
  static readonly storageKey = 'channel-settings';

  public readonly id: string;
  public readonly channelId: string;
  public readonly allowCommands: boolean;
  public readonly slowMode: number;

  constructor(guildId: string, channelId: string, data: ChannelSettingsData) {
    super(guildId);
    validateChannelId(channelId);

    this.id = channelId;
    this.channelId = channelId;
    this.allowCommands = data.allowCommands;
    this.slowMode = data.slowMode;
  }
}
```

**Register:**

```typescript
registry.register(ChannelSettings, (entity) => entity.guildId);
```

---

## Collection Key Strategies

The Entity Registry gives you flexibility in how entities are stored. The same entity type can use different collection key strategies.

### Guild-Scoped Storage

Store data per guild (most common for Discord bots):

```typescript
registry.register(UserStats, (entity) => entity.guildId);
```

Storage: `db["guild-123"]["user-stats"]` - Each guild has its own collection of user stats.

### User-Scoped Storage

Store data per user (cross-guild data):

```typescript
export class UserProfile {
  static readonly storageKey = 'user-profiles';

  constructor(
    public readonly userId: string,
    public readonly favoriteColor: string,
    public readonly timezone: string
  ) {}
}

registry.register(UserProfile, (entity) => entity.userId);
```

Storage: `db["user-123"]["user-profiles"]` - Each user has their own collection, accessible across all guilds.

**Use case:** User preferences that should be the same everywhere, or for bots that work in DMs.

### App-Scoped Storage

Store global singleton data:

```typescript
export class BotSettings {
  static readonly storageKey = 'bot-settings';

  constructor(
    public readonly maintenanceMode: boolean,
    public readonly globalPrefix: string
  ) {}
}

registry.register(BotSettings, () => 'app');
```

Storage: `db["app"]["bot-settings"]` - Single global collection for the entire bot.

**Use case:** Bot-wide configuration that applies everywhere.

### Flexible Strategy Example

You can even change strategies based on runtime conditions:

```typescript
// For bots that support both guilds and DMs:
registry.register(UserData, (entity) => {
  // Use guildId if present, otherwise use userId for DMs
  return entity.guildId || entity.userId;
});
```

---

## Using Entities in Your Bot

### Store Entities

```typescript
// Create and store user stats
const userStats = new UserStats(guildId, userId, username, {
  level: 1,
  experience: 0,
  lastActive: new Date().toISOString()
});

await repository.store(userStats);
```

The repository uses the registry to extract `guildId` and stores it in `db[guildId]["user-stats"]`.

### Retrieve Entities

```typescript
// Get all user stats for a guild
const allStats = await repository.getAll(UserStats, guildId);

// Find specific user
const userStats = allStats.find(s => s.userId === userId);
```

### Update Entities

```typescript
// Get current stats
const stats = await repository.getAll(UserStats, guildId);
const userStats = stats.find(s => s.userId === userId);

if (userStats) {
  // Create updated version
  const updated = userStats.addExperience(50);

  // Store updated version
  await repository.store(updated);
}
```

### Query with Options

```typescript
// Get top 10 users by experience
const result = await repository.query(UserStats, guildId, {
  sort: (a, b) => b.experience - a.experience,
  limit: 10
});

console.log(result.entities); // Top 10 users
console.log(result.totalCount); // Total users in guild
console.log(result.hasMore); // Are there more results?
```

### Delete by ID

```typescript
// Delete a specific user's stats
const deleted = await repository.deleteById(UserStats, guildId, userId);
```

---

## Validation in Constructors

Add custom validation using Discord validators:

```typescript
import { DiscordEntity, validateGuildId, validateUserId } from '@outof-coffee/cordex';

export class CustomEntity extends DiscordEntity {
  static readonly storageKey = 'custom-entities';

  public readonly userId: string;
  public readonly value: number;

  constructor(guildId: string, userId: string, value: number) {
    super(guildId); // Validates guildId automatically
    validateUserId(userId); // Validate userId

    // Custom validation
    if (value < 0 || value > 100) {
      throw new Error('Value must be between 0 and 100');
    }

    this.userId = userId;
    this.value = value;
  }
}
```

---

## Best Practices

1. **Always set storageKey**: Required static property for all entities
2. **Register all entities**: Use `registry.register()` before calling `repository.initialize()`
3. **Use validators**: Leverage built-in Discord ID validators (`validateGuildId`, `validateUserId`, etc.)
4. **Immutable patterns**: Return new instances instead of mutating existing ones
5. **Simple types**: Keep entities focused and simple - they're just data containers
6. **Validation in constructor**: Fail fast with clear errors
7. **Choose the right collection key**: Guild-scoped for per-server data, user-scoped for cross-server data, app-scoped for globals

---

## Working Example

See the complete example bot at `examples/discord-bot/` which demonstrates:
- Entity Registry setup and registration
- `UserProfile` entity with user-scoped storage
- `GuildSettings` entity with guild-scoped storage
- Repository operations in a real bot
- Both slash and prefix commands

Run the example:
```bash
cd examples/discord-bot
npm install
npm run build
npm start
```
