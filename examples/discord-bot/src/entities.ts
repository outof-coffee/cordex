import { DiscordEntity, validateUserId, IdentifiedEntity } from '@outof-coffee/discord-wheel';

/**
 * User profile data interface
 */
export interface UserProfileData {
  level: number;
  experience: number;
  favoriteColor?: string;
  timezone?: string;
  createdAt: string;
}

/**
 * UserProfile - User-owned entity demonstrating personal bot pattern
 *
 * Can be used in two contexts:
 * 1. Personal/DM context: guildId = userId (user's personal data)
 * 2. Server context: guildId = actual guild ID (per-server user data)
 *
 * Implements IdentifiedEntity to support id-based operations
 */
export class UserProfile extends DiscordEntity implements IdentifiedEntity {
  static readonly storageKey = 'user-profiles';

  public readonly id: string;
  public readonly userId: string;
  public readonly username: string;
  public readonly level: number;
  public readonly experience: number;
  public readonly favoriteColor?: string;
  public readonly timezone?: string;
  public readonly createdAt: string;
  public readonly updatedAt: string;

  constructor(guildId: string, userId: string, username: string, data: UserProfileData) {
    super(guildId);
    validateUserId(userId);

    this.id = userId;
    this.userId = userId;
    this.username = username;
    this.level = data.level;
    this.experience = data.experience;
    this.favoriteColor = data.favoriteColor;
    this.timezone = data.timezone;
    this.createdAt = data.createdAt;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Create updated profile with added experience
   */
  public addExperience(amount: number): UserProfile {
    const newExp = this.experience + amount;
    const newLevel = Math.floor(newExp / 100) + 1;

    return new UserProfile(this.guildId, this.userId, this.username, {
      level: newLevel,
      experience: newExp,
      favoriteColor: this.favoriteColor,
      timezone: this.timezone,
      createdAt: this.createdAt
    });
  }

  /**
   * Check if this is a personal profile (DM context)
   */
  public isPersonal(): boolean {
    return this.guildId === this.userId;
  }
}

/**
 * Guild settings data interface
 */
export interface GuildSettingsData {
  prefix: string;
  enableLeaderboard: boolean;
  welcomeMessage?: string;
}

/**
 * GuildSettings - Guild-owned entity demonstrating server configuration
 *
 * Stores per-guild configuration (one per guild)
 * Does not implement IdentifiedEntity as there's only one config per guild
 */
export class GuildSettings extends DiscordEntity {
  static readonly storageKey = 'guild-settings';

  public readonly prefix: string;
  public readonly enableLeaderboard: boolean;
  public readonly welcomeMessage?: string;
  public readonly updatedAt: string;

  constructor(guildId: string, data: GuildSettingsData) {
    super(guildId);

    this.prefix = data.prefix;
    this.enableLeaderboard = data.enableLeaderboard;
    this.welcomeMessage = data.welcomeMessage;
    this.updatedAt = new Date().toISOString();
  }
}
