import { repository } from '@outof-coffee/discord-wheel';
import { UserProfile, UserProfileData, GuildSettings, GuildSettingsData } from './entities';

/**
 * Database service for the example Discord bot
 * Demonstrates repository usage patterns with discord-wheel
 */
export class DatabaseService {
  /**
   * Get context ID for storage
   * - DM context: userId (personal storage)
   * - Guild context: guildId (per-server storage)
   */
  static getContextId(guildId: string | null, userId: string): string {
    return guildId || userId;
  }

  /**
   * Get or create user profile
   * Works in both DM and guild contexts
   */
  static async getOrCreateUserProfile(
    contextId: string,
    userId: string,
    username: string
  ): Promise<UserProfile> {
    const allProfiles = await repository.getAll(UserProfile, contextId);
    const existing = allProfiles.find(p => p.userId === userId);

    if (existing) {
      return existing;
    }

    const newProfile = new UserProfile(contextId, userId, username, {
      level: 1,
      experience: 0,
      createdAt: new Date().toISOString()
    });

    await repository.store(newProfile);
    return newProfile;
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(profile: UserProfile): Promise<void> {
    await repository.store(profile);
  }

  /**
   * Award experience to user
   */
  static async awardExperience(
    contextId: string,
    userId: string,
    username: string,
    amount: number = 10
  ): Promise<UserProfile> {
    const profile = await this.getOrCreateUserProfile(contextId, userId, username);
    const updated = profile.addExperience(amount);
    await this.updateUserProfile(updated);
    return updated;
  }

  /**
   * Get top users by experience (guild context only)
   */
  static async getTopUsers(guildId: string, limit: number = 10): Promise<UserProfile[]> {
    const allProfiles = await repository.getAll(UserProfile, guildId);
    return allProfiles
      .sort((a, b) => b.experience - a.experience)
      .slice(0, limit);
  }

  /**
   * Get or create guild settings (guild context only)
   */
  static async getOrCreateGuildSettings(guildId: string): Promise<GuildSettings> {
    const allSettings = await repository.getAll(GuildSettings, guildId);
    const existing = allSettings[0];

    if (existing) {
      return existing;
    }

    const defaultSettings = new GuildSettings(guildId, {
      prefix: '!',
      enableLeaderboard: true
    });

    await repository.store(defaultSettings);
    return defaultSettings;
  }

  /**
   * Update guild settings
   */
  static async updateGuildSettings(settings: GuildSettings): Promise<void> {
    await repository.store(settings);
  }
}
