import { repository } from '@outof-coffee/discord-wheel';
import { PlayerStats, PlayerStatsData, BotGuildConfig, BotGuildConfigData, CommandLog, CommandLogData, Warning, WarningData } from './entities';

/**
 * Database service for the example Discord bot
 * Handles all database operations using the discord-wheel repository
 */
export class DatabaseService {
  /**
   * Get or create player statistics for a user
   */
  static async getOrCreatePlayerStats(guildId: string, userId: string, username: string): Promise<PlayerStats> {
    const allStats = await repository.getAll(PlayerStats, guildId);
    const existingStats = allStats.find(stats => stats.userId === userId);
    
    if (existingStats) {
      return existingStats;
    }

    // Create new player stats
    const newStats = new PlayerStats(guildId, userId, username, {
      level: 1,
      experience: 0,
      lastActivity: new Date().toISOString(),
      commandsUsed: 0,
      achievements: [],
      joinedAt: new Date().toISOString()
    });

    await repository.store(newStats);
    return newStats;
  }

  /**
   * Update player statistics
   */
  static async updatePlayerStats(stats: PlayerStats): Promise<void> {
    await repository.store(stats);
  }

  /**
   * Get guild configuration or create default
   */
  static async getOrCreateGuildConfig(guildId: string): Promise<BotGuildConfig> {
    const allConfigs = await repository.getAll(BotGuildConfig, guildId);
    const existingConfig = allConfigs[0]; // Only one config per guild
    
    if (existingConfig) {
      return existingConfig;
    }

    // Create default guild config
    const defaultConfig = new BotGuildConfig(guildId, {
      prefix: '!',
      enableStats: true,
      enableWelcome: false
    });

    await repository.store(defaultConfig);
    return defaultConfig;
  }

  /**
   * Update guild configuration
   */
  static async updateGuildConfig(config: BotGuildConfig): Promise<void> {
    await repository.store(config);
  }

  /**
   * Log command usage
   */
  static async logCommand(guildId: string, data: CommandLogData): Promise<void> {
    const log = new CommandLog(guildId, data);
    await repository.store(log);
  }

  /**
   * Get top players by experience in a guild
   */
  static async getTopPlayers(guildId: string, limit: number = 10): Promise<PlayerStats[]> {
    const allStats = await repository.getAll(PlayerStats, guildId);
    return allStats
      .sort((a, b) => b.experience - a.experience)
      .slice(0, limit);
  }

  /**
   * Get command usage statistics
   */
  static async getCommandStats(guildId: string, days: number = 7): Promise<{ commandName: string; count: number }[]> {
    const allLogs = await repository.getAll(CommandLog, guildId);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const recentLogs = allLogs.filter(log => new Date(log.timestamp) > cutoff);
    const commandCounts = new Map<string, number>();
    
    for (const log of recentLogs) {
      if (log.success) {
        commandCounts.set(log.commandName, (commandCounts.get(log.commandName) || 0) + 1);
      }
    }
    
    return Array.from(commandCounts.entries())
      .map(([commandName, count]) => ({ commandName, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Award experience to a player for using commands
   */
  static async awardExperience(guildId: string, userId: string, username: string, amount: number = 10): Promise<PlayerStats> {
    const stats = await this.getOrCreatePlayerStats(guildId, userId, username);
    const newStats = stats.addExperience(amount);
    
    // Check for level up achievement
    if (newStats.level > stats.level) {
      const levelUpStats = newStats.addAchievement(`Level ${newStats.level}`);
      await this.updatePlayerStats(levelUpStats);
      return levelUpStats;
    }
    
    await this.updatePlayerStats(newStats);
    return newStats;
  }

  /**
   * Issue a warning to a user
   */
  static async issueWarning(guildId: string, data: WarningData): Promise<Warning> {
    const warning = new Warning(guildId, data);
    await repository.store(warning);
    return warning;
  }

  /**
   * Get active warnings for a user
   */
  static async getUserWarnings(guildId: string, userId: string): Promise<Warning[]> {
    const allWarnings = await repository.getAll(Warning, guildId);
    return allWarnings.filter(warning => warning.userId === userId && warning.active);
  }

  /**
   * Get all warnings (active and inactive) for a user
   */
  static async getAllUserWarnings(guildId: string, userId: string): Promise<Warning[]> {
    const allWarnings = await repository.getAll(Warning, guildId);
    return allWarnings.filter(warning => warning.userId === userId);
  }

  /**
   * Clear (deactivate) a specific warning
   */
  static async clearWarning(guildId: string, warningId: string): Promise<boolean> {
    const allWarnings = await repository.getAll(Warning, guildId);
    const warning = allWarnings.find(w => w.warningId === warningId && w.active);
    
    if (!warning) {
      return false;
    }

    const deactivatedWarning = warning.deactivate();
    await repository.store(deactivatedWarning);
    return true;
  }

  /**
   * Clear all active warnings for a user
   */
  static async clearAllUserWarnings(guildId: string, userId: string): Promise<number> {
    const activeWarnings = await this.getUserWarnings(guildId, userId);
    
    for (const warning of activeWarnings) {
      const deactivatedWarning = warning.deactivate();
      await repository.store(deactivatedWarning);
    }
    
    return activeWarnings.length;
  }

  /**
   * Check if user has admin permissions (has mod role or is admin)
   */
  static async hasAdminPermission(guildId: string, userId: string, userRoles: string[]): Promise<boolean> {
    const config = await this.getOrCreateGuildConfig(guildId);
    
    // Check if user has the configured mod role
    if (config.modRoleId && userRoles.includes(config.modRoleId)) {
      return true;
    }
    
    // Additional checks could be added here (server owner, admin permissions, etc.)
    return false;
  }
}
