import { DiscordEntity, validateUserId } from '@outof-coffee/discord-wheel';

/**
 * Player statistics interface
 */
export interface PlayerStatsData {
  level: number;
  experience: number;
  lastActivity: string;
  commandsUsed: number;
  achievements: string[];
  joinedAt: string;
}

/**
 * Player statistics entity for tracking user progression and activity
 */
export class PlayerStats extends DiscordEntity {
  static readonly storageKey = 'player-stats';

  public readonly userId: string;
  public readonly username: string;
  public readonly level: number;
  public readonly experience: number;
  public readonly lastActivity: string;
  public readonly commandsUsed: number;
  public readonly achievements: string[];
  public readonly joinedAt: string;
  public readonly updatedAt: string;

  constructor(guildId: string, userId: string, username: string, stats: PlayerStatsData) {
    super(guildId);
    validateUserId(userId);
    
    this.userId = userId;
    this.username = username;
    this.level = stats.level;
    this.experience = stats.experience;
    this.lastActivity = stats.lastActivity;
    this.commandsUsed = stats.commandsUsed;
    this.achievements = [...stats.achievements];
    this.joinedAt = stats.joinedAt;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Create a new PlayerStats with updated experience
   */
  public addExperience(amount: number): PlayerStats {
    const newExp = this.experience + amount;
    const newLevel = Math.floor(newExp / 100) + 1; // Level up every 100 XP
    
    return new PlayerStats(this.guildId, this.userId, this.username, {
      level: newLevel,
      experience: newExp,
      lastActivity: new Date().toISOString(),
      commandsUsed: this.commandsUsed + 1,
      achievements: this.achievements,
      joinedAt: this.joinedAt
    });
  }

  /**
   * Create a new PlayerStats with an added achievement
   */
  public addAchievement(achievement: string): PlayerStats {
    if (this.achievements.includes(achievement)) {
      return this;
    }

    return new PlayerStats(this.guildId, this.userId, this.username, {
      level: this.level,
      experience: this.experience,
      lastActivity: new Date().toISOString(),
      commandsUsed: this.commandsUsed,
      achievements: [...this.achievements, achievement],
      joinedAt: this.joinedAt
    });
  }

  /**
   * Get user's unique identifier within the guild
   */
  public get id(): string {
    return this.userId;
  }
}

/**
 * Simple guild configuration for the example bot
 */
export interface BotGuildConfigData {
  prefix: string;
  welcomeChannelId?: string;
  modRoleId?: string;
  enableStats: boolean;
  enableWelcome: boolean;
}

export class BotGuildConfig extends DiscordEntity {
  static readonly storageKey = 'bot-guild-configs';

  public readonly prefix: string;
  public readonly welcomeChannelId?: string;
  public readonly modRoleId?: string;
  public readonly enableStats: boolean;
  public readonly enableWelcome: boolean;
  public readonly updatedAt: string;

  constructor(guildId: string, config: BotGuildConfigData) {
    super(guildId);
    
    this.prefix = config.prefix;
    this.welcomeChannelId = config.welcomeChannelId;
    this.modRoleId = config.modRoleId;
    this.enableStats = config.enableStats;
    this.enableWelcome = config.enableWelcome;
    this.updatedAt = new Date().toISOString();
  }
}

/**
 * Command usage tracking for analytics
 */
export interface CommandLogData {
  commandName: string;
  userId: string;
  username: string;
  channelId: string;
  timestamp: string;
  success: boolean;
  errorMessage?: string;
}

export class CommandLog extends DiscordEntity {
  static readonly storageKey = 'command-logs';

  public readonly commandName: string;
  public readonly userId: string;
  public readonly username: string;
  public readonly channelId: string;
  public readonly timestamp: string;
  public readonly success: boolean;
  public readonly errorMessage?: string;

  constructor(guildId: string, data: CommandLogData) {
    super(guildId);
    validateUserId(data.userId);
    
    this.commandName = data.commandName;
    this.userId = data.userId;
    this.username = data.username;
    this.channelId = data.channelId;
    this.timestamp = data.timestamp;
    this.success = data.success;
    this.errorMessage = data.errorMessage;
  }

  public get id(): string {
    return `${this.userId}-${this.commandName}-${this.timestamp}`;
  }
}

/**
 * Warning system for moderation
 */
export interface WarningData {
  userId: string;
  username: string;
  moderatorId: string;
  moderatorName: string;
  reason: string;
  timestamp: string;
  active: boolean;
}

export class Warning extends DiscordEntity {
  static readonly storageKey = 'warnings';

  public readonly userId: string;
  public readonly username: string;
  public readonly moderatorId: string;
  public readonly moderatorName: string;
  public readonly reason: string;
  public readonly timestamp: string;
  public readonly active: boolean;
  public readonly warningId: string;

  constructor(guildId: string, data: WarningData) {
    super(guildId);
    validateUserId(data.userId);
    validateUserId(data.moderatorId);
    
    this.userId = data.userId;
    this.username = data.username;
    this.moderatorId = data.moderatorId;
    this.moderatorName = data.moderatorName;
    this.reason = data.reason;
    this.timestamp = data.timestamp;
    this.active = data.active;
    this.warningId = `warn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public get id(): string {
    return this.warningId;
  }

  /**
   * Create a copy of this warning marked as inactive
   */
  public deactivate(): Warning {
    return new Warning(this.guildId, {
      userId: this.userId,
      username: this.username,
      moderatorId: this.moderatorId,
      moderatorName: this.moderatorName,
      reason: this.reason,
      timestamp: this.timestamp,
      active: false
    });
  }
}
