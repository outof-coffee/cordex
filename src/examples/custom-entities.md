# Custom Entity Examples

This document provides comprehensive examples of how to create custom entities using the discord-wheel library, demonstrating the flexibility and power of the entity system.

## Basic Custom Entity

Here's how to create a simple custom entity for tracking player statistics:

```typescript
import { IdentifiedDiscordEntity, registerEntity } from '@outof-coffee/discord-wheel';

interface PlayerStats {
  level: number;
  experience: number;
  lastLogin: string;
  achievements: string[];
}

export class PlayerData extends IdentifiedDiscordEntity {
  static readonly storageKey = 'player-data';

  public readonly username: string;
  public readonly stats: PlayerStats;
  public readonly joinedAt: string;

  constructor(guildId: string, userId: string, username: string, stats: PlayerStats) {
    super(guildId, userId); // Use userId as the ID
    this.username = username;
    this.stats = { ...stats };
    this.joinedAt = new Date().toISOString();
  }

  // Helper methods
  public levelUp(): PlayerData {
    const newStats = {
      ...this.stats,
      level: this.stats.level + 1,
      experience: 0
    };
    return new PlayerData(this.guildId, this.id, this.username, newStats);
  }

  public addExperience(amount: number): PlayerData {
    const newStats = {
      ...this.stats,
      experience: this.stats.experience + amount
    };
    return new PlayerData(this.guildId, this.id, this.username, newStats);
  }
}

// Register the entity
registerEntity(PlayerData, {
  name: 'Player Data',
  description: 'Stores player statistics and progress',
  category: 'game',
  tags: ['player', 'stats', 'game'],
  version: '1.0.0'
});
```

## Temporary Entity Example

Create entities that automatically expire after a certain time:

```typescript
import { TemporaryDiscordEntity, registerEntity } from '@outof-coffee/discord-wheel';

export class BoostEffect extends TemporaryDiscordEntity {
  static readonly storageKey = 'boost-effects';

  public readonly userId: string;
  public readonly boostType: 'experience' | 'damage' | 'speed';
  public readonly multiplier: number;
  public readonly source: string; // What granted this boost

  constructor(
    guildId: string,
    userId: string,
    boostType: 'experience' | 'damage' | 'speed',
    multiplier: number,
    durationMs: number,
    source: string
  ) {
    super(guildId, durationMs);
    this.userId = userId;
    this.boostType = boostType;
    this.multiplier = multiplier;
    this.source = source;
  }

  // Check if this boost affects a specific action
  public affectsAction(action: string): boolean {
    switch (this.boostType) {
      case 'experience':
        return action === 'gainExp' || action === 'levelUp';
      case 'damage':
        return action === 'attack' || action === 'battle';
      case 'speed':
        return action === 'move' || action === 'travel';
      default:
        return false;
    }
  }
}

registerEntity(BoostEffect, {
  name: 'Boost Effect',
  description: 'Temporary player boosts with automatic expiration',
  category: 'game',
  tags: ['temporary', 'boost', 'player'],
  version: '1.0.0'
});
```

## Event-Based Entity Example

Track events and activities with rich metadata:

```typescript
import { EventDiscordEntity, registerEntity } from '@outof-coffee/discord-wheel';

export class CombatEvent extends EventDiscordEntity {
  static readonly storageKey = 'combat-events';

  public readonly attackerId: string;
  public readonly defenderId: string;
  public readonly damage: number;
  public readonly weapon: string;
  public readonly location: string;

  constructor(
    guildId: string,
    attackerId: string,
    defenderId: string,
    damage: number,
    weapon: string,
    location: string,
    additionalMetadata: Record<string, any> = {}
  ) {
    const metadata = {
      ...additionalMetadata,
      damage,
      weapon,
      location,
      combatType: 'pvp'
    };

    super(guildId, 'combat', metadata);
    this.attackerId = attackerId;
    this.defenderId = defenderId;
    this.damage = damage;
    this.weapon = weapon;
    this.location = location;
  }

  // Helper methods
  public wasFatal(): boolean {
    return this.getMetadata<boolean>('fatal') || false;
  }

  public getCriticalHit(): boolean {
    return this.getMetadata<boolean>('critical') || false;
  }
}

registerEntity(CombatEvent, {
  name: 'Combat Event',
  description: 'Records combat interactions between players',
  category: 'events',
  tags: ['combat', 'pvp', 'tracking'],
  version: '1.0.0'
});
```

## Channel-Associated Entity Example

Create entities tied to specific Discord channels:

```typescript
import { ChannelDiscordEntity, registerEntity } from '@outof-coffee/discord-wheel';

export class ChannelConfig extends ChannelDiscordEntity {
  static readonly storageKey = 'custom-channel-configs';

  public readonly gameMode: 'adventure' | 'battle' | 'trading' | 'social';
  public readonly allowedCommands: string[];
  public readonly experienceMultiplier: number;
  public readonly customRules: string[];

  constructor(
    guildId: string,
    channelId: string,
    gameMode: 'adventure' | 'battle' | 'trading' | 'social',
    config: {
      allowedCommands?: string[];
      experienceMultiplier?: number;
      customRules?: string[];
    } = {}
  ) {
    super(guildId, channelId);
    this.gameMode = gameMode;
    this.allowedCommands = config.allowedCommands || [];
    this.experienceMultiplier = config.experienceMultiplier || 1.0;
    this.customRules = config.customRules || [];
  }

  public isCommandAllowed(command: string): boolean {
    return this.allowedCommands.length === 0 || this.allowedCommands.includes(command);
  }
}

registerEntity(ChannelConfig, {
  name: 'Game Channel Config',
  description: 'Configuration for game-specific channel behavior',
  category: 'config',
  tags: ['channel', 'game', 'configuration'],
  version: '1.0.0'
});
```

## Using Custom Entities in Your Bot

Here's how to use these custom entities in your Discord bot:

```typescript
import { enhancedRepository } from '@outof-coffee/discord-wheel';
import { PlayerData, BoostEffect, CombatEvent, ChannelConfig } from './entities';

// Initialize the repository
await enhancedRepository.initialize({
  databasePath: './data/bot.json',
  enableCaching: true,
  validateDiscordIds: true
});

export class GameBot {

  // Player management
  async createPlayer(guildId: string, userId: string, username: string) {
    const initialStats = {
      level: 1,
      experience: 0,
      lastLogin: new Date().toISOString(),
      achievements: []
    };

    const player = new PlayerData(guildId, userId, username, initialStats);
    await enhancedRepository.store(player);
    return player;
  }

  async getPlayer(guildId: string, userId: string): Promise<PlayerData | null> {
    return enhancedRepository.getById(PlayerData, guildId, userId);
  }

  async updatePlayerStats(guildId: string, userId: string, newStats: Partial<PlayerStats>) {
    const player = await this.getPlayer(guildId, userId);
    if (!player) return null;

    const updatedStats = { ...player.stats, ...newStats };
    const updatedPlayer = new PlayerData(guildId, userId, player.username, updatedStats);

    await enhancedRepository.store(updatedPlayer);
    return updatedPlayer;
  }

  // Boost management
  async applyBoost(
    guildId: string,
    userId: string,
    boostType: 'experience' | 'damage' | 'speed',
    multiplier: number,
    durationMinutes: number,
    source: string
  ) {
    const boost = new BoostEffect(
      guildId,
      userId,
      boostType,
      multiplier,
      durationMinutes * 60 * 1000, // Convert to milliseconds
      source
    );

    await enhancedRepository.store(boost);
    return boost;
  }

  async getActiveBoosts(guildId: string, userId: string): Promise<BoostEffect[]> {
    const allBoosts = await enhancedRepository.getUserEntities(BoostEffect, guildId, userId);
    return allBoosts.filter(boost => !boost.isExpired());
  }

  async calculateExperienceMultiplier(guildId: string, userId: string): Promise<number> {
    const activeBoosts = await this.getActiveBoosts(guildId, userId);
    const expBoosts = activeBoosts.filter(boost => boost.boostType === 'experience');

    return expBoosts.reduce((total, boost) => total * boost.multiplier, 1.0);
  }

  // Combat system
  async recordCombat(
    guildId: string,
    attackerId: string,
    defenderId: string,
    damage: number,
    weapon: string,
    location: string,
    fatal: boolean = false,
    critical: boolean = false
  ) {
    const combat = new CombatEvent(
      guildId,
      attackerId,
      defenderId,
      damage,
      weapon,
      location,
      { fatal, critical }
    );

    await enhancedRepository.store(combat);
    return combat;
  }

  async getCombatHistory(guildId: string, userId: string, limit: number = 10) {
    return enhancedRepository.query(CombatEvent, guildId, {
      filter: (event) => event.attackerId === userId || event.defenderId === userId,
      sort: (a, b) => b.timestamp.localeCompare(a.timestamp),
      limit
    });
  }

  // Channel configuration
  async setupGameChannel(
    guildId: string,
    channelId: string,
    gameMode: 'adventure' | 'battle' | 'trading' | 'social',
    config: any = {}
  ) {
    const channelConfig = new ChannelConfig(guildId, channelId, gameMode, config);
    await enhancedRepository.store(channelConfig);
    return channelConfig;
  }

  async getChannelConfig(guildId: string, channelId: string): Promise<ChannelConfig | null> {
    return enhancedRepository.getById(ChannelConfig, guildId, channelId);
  }

  // Advanced queries
  async getTopPlayers(guildId: string, limit: number = 10) {
    return enhancedRepository.query(PlayerData, guildId, {
      sort: (a, b) => {
        // Sort by level first, then by experience
        if (a.stats.level !== b.stats.level) {
          return b.stats.level - a.stats.level;
        }
        return b.stats.experience - a.stats.experience;
      },
      limit
    });
  }

  async getRecentCombats(guildId: string, hours: number = 24) {
    return enhancedRepository.query(CombatEvent, guildId, {
      maxAgeHours: hours,
      sort: (a, b) => b.timestamp.localeCompare(a.timestamp)
    });
  }

  // Maintenance operations
  async cleanupExpiredBoosts(guildId: string): Promise<number> {
    const expired = await enhancedRepository.getExpiredTemporary(BoostEffect, guildId);
    const active = await enhancedRepository.getActiveTemporary(BoostEffect, guildId);

    await enhancedRepository.replaceAll(BoostEffect, guildId, active);
    return expired.length;
  }

  async getGuildStatistics(guildId: string) {
    const stats = await enhancedRepository.getGuildStats(guildId);
    const playerCount = await enhancedRepository.count(PlayerData, guildId);
    const activeBoosts = await enhancedRepository.count(
      BoostEffect,
      guildId,
      (boost) => !boost.isExpired()
    );

    return {
      ...stats,
      activePlayers: playerCount,
      activeBoosts
    };
  }
}
```

## Advanced Patterns

### Custom Entity with Validation

```typescript
import { IdentifiedDiscordEntity } from '@outof-coffee/discord-wheel';

export class GuildSettings extends IdentifiedDiscordEntity {
  static readonly storageKey = 'guild-settings';

  public readonly prefix: string;
  public readonly language: string;
  public readonly features: Set<string>;

  constructor(guildId: string, prefix: string, language: string, features: string[] = []) {
    super(guildId, guildId); // Use guildId as ID for singleton pattern

    // Validation
    if (prefix.length === 0 || prefix.length > 5) {
      throw new Error('Prefix must be 1-5 characters');
    }

    if (!['en', 'es', 'fr', 'de', 'ja'].includes(language)) {
      throw new Error('Unsupported language');
    }

    this.prefix = prefix;
    this.language = language;
    this.features = new Set(features);
  }

  public hasFeature(feature: string): boolean {
    return this.features.has(feature);
  }

  public enableFeature(feature: string): GuildSettings {
    const newFeatures = Array.from(this.features);
    newFeatures.push(feature);
    return new GuildSettings(this.guildId, this.prefix, this.language, newFeatures);
  }
}
```

### Entity with Relationships

```typescript
import { IdentifiedDiscordEntity } from '@outof-coffee/discord-wheel';

export class Quest extends IdentifiedDiscordEntity {
  static readonly storageKey = 'quests';

  public readonly title: string;
  public readonly description: string;
  public readonly requirements: string[];
  public readonly rewards: Record<string, number>;
  public readonly prerequisiteQuestIds: string[];

  constructor(
    guildId: string,
    title: string,
    description: string,
    requirements: string[],
    rewards: Record<string, number>,
    prerequisiteQuestIds: string[] = [],
    questId?: string
  ) {
    super(guildId, questId);
    this.title = title;
    this.description = description;
    this.requirements = requirements;
    this.rewards = rewards;
    this.prerequisiteQuestIds = prerequisiteQuestIds;
  }

  public async getPrerequisites(repository: any): Promise<Quest[]> {
    const prerequisites: Quest[] = [];
    for (const questId of this.prerequisiteQuestIds) {
      const quest = await repository.getById(Quest, this.guildId, questId);
      if (quest) prerequisites.push(quest);
    }
    return prerequisites;
  }
}

export class QuestProgress extends IdentifiedDiscordEntity {
  static readonly storageKey = 'quest-progress';

  public readonly userId: string;
  public readonly questId: string;
  public readonly progress: Record<string, number>;
  public readonly startedAt: string;
  public readonly completedAt: string | null;

  constructor(
    guildId: string,
    userId: string,
    questId: string,
    progress: Record<string, number> = {},
    startedAt?: string,
    completedAt?: string | null
  ) {
    super(guildId, `${userId}-${questId}`);
    this.userId = userId;
    this.questId = questId;
    this.progress = progress;
    this.startedAt = startedAt || new Date().toISOString();
    this.completedAt = completedAt || null;
  }

  public isCompleted(): boolean {
    return this.completedAt !== null;
  }

  public updateProgress(key: string, value: number): QuestProgress {
    const newProgress = { ...this.progress, [key]: value };
    return new QuestProgress(
      this.guildId,
      this.userId,
      this.questId,
      newProgress,
      this.startedAt,
      this.completedAt
    );
  }
}
```

This comprehensive example system demonstrates how to create flexible, type-safe custom entities that integrate seamlessly with Discord and provide powerful data management capabilities for your bot.