import { Client, GatewayIntentBits, Events, Message, ChatInputCommandInteraction, SlashCommandBuilder, REST, Routes, PermissionFlagsBits, GuildMember } from 'discord.js';
import { config } from 'dotenv';
import { repository } from '@outof-coffee/discord-wheel';
import { DatabaseService } from './database';
import { PlayerStats, Warning } from './entities';

// Load environment variables
config();

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = process.env.COMMAND_PREFIX || '!';
const TEST_GUILD_ID = process.env.TEST_GUILD_ID;

if (!TOKEN) {
  console.error('DISCORD_TOKEN is required in environment variables');
  process.exit(1);
}

if (!TEST_GUILD_ID) {
  console.error('TEST_GUILD_ID is required for slash command registration');
  process.exit(1);
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Initialize discord-wheel repository
async function initializeDatabase() {
  try {
    await repository.initialize({
      databasePath: './data/bot-database.json'
    });
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

// Register slash commands for the test guild
async function registerSlashCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('Replies with Pong!'),
    
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Shows available commands'),
    
    new SlashCommandBuilder()
      .setName('stats')
      .setDescription('Show your player statistics')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to show stats for (defaults to you)')
          .setRequired(false)
      ),
    
    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Show top players by experience')
      .addIntegerOption(option =>
        option.setName('limit')
          .setDescription('Number of players to show (1-20)')
          .setMinValue(1)
          .setMaxValue(20)
          .setRequired(false)
      ),
    
    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Issue a warning to a user (Moderator only)')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to warn')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for the warning')
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    new SlashCommandBuilder()
      .setName('warnings')
      .setDescription('View warnings for a user')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to check warnings for (defaults to yourself)')
          .setRequired(false)
      ),
    
    new SlashCommandBuilder()
      .setName('clearwarning')
      .setDescription('Clear a specific warning (Moderator only)')
      .addStringOption(option =>
        option.setName('warning_id')
          .setDescription('Warning ID to clear')
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    new SlashCommandBuilder()
      .setName('commandstats')
      .setDescription('Show command usage statistics (Moderator only)')
      .addIntegerOption(option =>
        option.setName('days')
          .setDescription('Number of days to analyze (1-30)')
          .setMinValue(1)
          .setMaxValue(30)
          .setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  ];

  try {
    const rest = new REST().setToken(TOKEN!);
    console.log('🔄 Registering slash commands...');
    
    await rest.put(
      Routes.applicationGuildCommands(client.user!.id, TEST_GUILD_ID!),
      { body: commands.map(cmd => cmd.toJSON()) }
    );
    
    console.log('✅ Slash commands registered successfully');
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
  }
}

// Handle attention commands (prefix-based)
async function handleAttentionCommand(message: Message) {
  if (!message.content.startsWith(PREFIX) || message.author.bot || !message.guild) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  try {
    // Award experience for using commands
    await DatabaseService.awardExperience(message.guild.id, message.author.id, message.author.displayName);
    
    // Log command usage
    await DatabaseService.logCommand(message.guild.id, {
      commandName: command || 'unknown',
      userId: message.author.id,
      username: message.author.displayName,
      channelId: message.channel.id,
      timestamp: new Date().toISOString(),
      success: true
    });

    switch (command) {
      case 'ping':
        await message.reply('Pong! 🏓');
        break;
      
      case 'help':
        await message.reply(`
**Available Commands:**
Attention Commands (${PREFIX}):
• \`${PREFIX}ping\` - Test bot responsiveness
• \`${PREFIX}help\` - Show this help message
• \`${PREFIX}stats [@user]\` - Show player statistics
• \`${PREFIX}leaderboard [number]\` - Show top players
• \`${PREFIX}warnings [@user]\` - View warnings for a user
• \`${PREFIX}warn @user <reason>\` - Issue warning (Moderator only)

Slash Commands (/):
• \`/ping\` - Test bot responsiveness
• \`/help\` - Show available commands
• \`/stats [user]\` - Show player statistics
• \`/leaderboard [limit]\` - Show top players
• \`/warnings [user]\` - View warnings for a user
• \`/warn <user> <reason>\` - Issue warning (Moderator only)
• \`/clearwarning <warning_id>\` - Clear specific warning (Moderator only)
• \`/commandstats [days]\` - Show command usage stats (Moderator only)
        `);
        break;
      
      case 'stats':
        const mentionedUser = message.mentions.users.first() || message.author;
        const stats = await DatabaseService.getOrCreatePlayerStats(
          message.guild.id, 
          mentionedUser.id, 
          mentionedUser.displayName
        );
        
        await message.reply(`
📊 **Stats for ${mentionedUser.displayName}**
🎯 Level: ${stats.level}
⭐ Experience: ${stats.experience}
🔧 Commands Used: ${stats.commandsUsed}
🏆 Achievements: ${stats.achievements.length > 0 ? stats.achievements.join(', ') : 'None yet'}
📅 Joined: ${new Date(stats.joinedAt).toLocaleDateString()}
        `);
        break;
      
      case 'leaderboard':
        const limit = parseInt(args[0]) || 10;
        const topPlayers = await DatabaseService.getTopPlayers(message.guild.id, Math.min(limit, 20));
        
        if (topPlayers.length === 0) {
          await message.reply('📊 No player data found yet!');
          break;
        }
        
        const leaderboard = topPlayers
          .map((player, index) => `${index + 1}. **${player.username}** - Level ${player.level} (${player.experience} XP)`)
          .join('\n');
        
        await message.reply(`
🏆 **Leaderboard - Top ${topPlayers.length} Players**
${leaderboard}
        `);
        break;
      
      case 'warnings':
        const warningsUser = message.mentions.users.first() || message.author;
        const userWarnings = await DatabaseService.getAllUserWarnings(message.guild.id, warningsUser.id);
        
        if (userWarnings.length === 0) {
          await message.reply(`📋 ${warningsUser.displayName} has no warnings.`);
          break;
        }
        
        const activeWarnings = userWarnings.filter(w => w.active);
        const warningsList = userWarnings
          .slice(0, 10) // Limit to 10 most recent
          .map(w => `${w.active ? '🔴' : '⚪'} **${w.warningId}** - ${w.reason} (by ${w.moderatorName}, ${new Date(w.timestamp).toLocaleDateString()})`)
          .join('\n');
        
        await message.reply(`
📋 **Warnings for ${warningsUser.displayName}**
Active: ${activeWarnings.length} | Total: ${userWarnings.length}

${warningsList}
        `);
        break;
      
      case 'warn':
        const targetUser = message.mentions.users.first();
        if (!targetUser) {
          await message.reply('❌ Please mention a user to warn.');
          break;
        }
        
        const reason = args.slice(1).join(' ');
        if (!reason) {
          await message.reply('❌ Please provide a reason for the warning.');
          break;
        }
        
        // Check if user has permission (simplified check - in real bot you'd check roles)
        const member = await message.guild.members.fetch(message.author.id);
        const hasPermission = member.permissions.has(PermissionFlagsBits.ModerateMembers);
        
        if (!hasPermission) {
          await message.reply('❌ You do not have permission to issue warnings.');
          break;
        }
        
        const warning = await DatabaseService.issueWarning(message.guild.id, {
          userId: targetUser.id,
          username: targetUser.displayName,
          moderatorId: message.author.id,
          moderatorName: message.author.displayName,
          reason: reason,
          timestamp: new Date().toISOString(),
          active: true
        });
        
        await message.reply(`⚠️ **Warning issued to ${targetUser.displayName}**\nID: ${warning.warningId}\nReason: ${reason}`);
        break;
      
      default:
        await message.reply(`❓ Unknown command. Use \`${PREFIX}help\` for available commands.`);
    }
  } catch (error) {
    console.error('Error handling attention command:', error);
    
    // Log failed command
    await DatabaseService.logCommand(message.guild.id, {
      commandName: command || 'unknown',
      userId: message.author.id,
      username: message.author.displayName,
      channelId: message.channel.id,
      timestamp: new Date().toISOString(),
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    
    await message.reply('❌ Something went wrong while processing your command.');
  }
}

// Handle slash commands
async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  try {
    // Award experience for using commands
    await DatabaseService.awardExperience(interaction.guild.id, interaction.user.id, interaction.user.displayName);
    
    // Log command usage
    await DatabaseService.logCommand(interaction.guild.id, {
      commandName: interaction.commandName,
      userId: interaction.user.id,
      username: interaction.user.displayName,
      channelId: interaction.channel?.id || 'unknown',
      timestamp: new Date().toISOString(),
      success: true
    });

    switch (interaction.commandName) {
      case 'ping':
        await interaction.reply('Pong! 🏓');
        break;
      
      case 'help':
        await interaction.reply(`
**Available Commands:**
Attention Commands (${PREFIX}):
• \`${PREFIX}ping\` - Test bot responsiveness
• \`${PREFIX}help\` - Show this help message
• \`${PREFIX}stats [@user]\` - Show player statistics
• \`${PREFIX}leaderboard [number]\` - Show top players
• \`${PREFIX}warnings [@user]\` - View warnings for a user
• \`${PREFIX}warn @user <reason>\` - Issue warning (Moderator only)

Slash Commands (/):
• \`/ping\` - Test bot responsiveness
• \`/help\` - Show available commands
• \`/stats [user]\` - Show player statistics
• \`/leaderboard [limit]\` - Show top players
• \`/warnings [user]\` - View warnings for a user
• \`/warn <user> <reason>\` - Issue warning (Moderator only)
• \`/clearwarning <warning_id>\` - Clear specific warning (Moderator only)
• \`/commandstats [days]\` - Show command usage stats (Moderator only)
        `);
        break;
      
      case 'stats':
        const user = interaction.options.getUser('user') || interaction.user;
        const stats = await DatabaseService.getOrCreatePlayerStats(
          interaction.guild.id, 
          user.id, 
          user.displayName
        );
        
        await interaction.reply(`
📊 **Stats for ${user.displayName}**
🎯 Level: ${stats.level}
⭐ Experience: ${stats.experience}
🔧 Commands Used: ${stats.commandsUsed}
🏆 Achievements: ${stats.achievements.length > 0 ? stats.achievements.join(', ') : 'None yet'}
📅 Joined: ${new Date(stats.joinedAt).toLocaleDateString()}
        `);
        break;
      
      case 'leaderboard':
        const limit = interaction.options.getInteger('limit') || 10;
        const topPlayers = await DatabaseService.getTopPlayers(interaction.guild.id, Math.min(limit, 20));
        
        if (topPlayers.length === 0) {
          await interaction.reply('📊 No player data found yet!');
          break;
        }
        
        const leaderboard = topPlayers
          .map((player, index) => `${index + 1}. **${player.username}** - Level ${player.level} (${player.experience} XP)`)
          .join('\n');
        
        await interaction.reply(`
🏆 **Leaderboard - Top ${topPlayers.length} Players**
${leaderboard}
        `);
        break;
      
      case 'warn':
        const warnTarget = interaction.options.getUser('user', true);
        const warnReason = interaction.options.getString('reason', true);
        
        const warnMember = interaction.member as GuildMember;
        if (!warnMember || !warnMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          await interaction.reply({ content: '❌ You do not have permission to issue warnings.', ephemeral: true });
          break;
        }
        
        const newWarning = await DatabaseService.issueWarning(interaction.guild.id, {
          userId: warnTarget.id,
          username: warnTarget.displayName,
          moderatorId: interaction.user.id,
          moderatorName: interaction.user.displayName,
          reason: warnReason,
          timestamp: new Date().toISOString(),
          active: true
        });
        
        await interaction.reply(`⚠️ **Warning issued to ${warnTarget.displayName}**\nID: ${newWarning.warningId}\nReason: ${warnReason}`);
        break;
      
      case 'warnings':
        const warningsTarget = interaction.options.getUser('user') || interaction.user;
        const allWarnings = await DatabaseService.getAllUserWarnings(interaction.guild.id, warningsTarget.id);
        
        if (allWarnings.length === 0) {
          await interaction.reply(`📋 ${warningsTarget.displayName} has no warnings.`);
          break;
        }
        
        const activeCount = allWarnings.filter(w => w.active).length;
        const warningsDisplay = allWarnings
          .slice(0, 10)
          .map(w => `${w.active ? '🔴' : '⚪'} **${w.warningId}** - ${w.reason} (by ${w.moderatorName}, ${new Date(w.timestamp).toLocaleDateString()})`)
          .join('\n');
        
        await interaction.reply(`
📋 **Warnings for ${warningsTarget.displayName}**
Active: ${activeCount} | Total: ${allWarnings.length}

${warningsDisplay}
        `);
        break;
      
      case 'clearwarning':
        const warningId = interaction.options.getString('warning_id', true);
        
        const clearMember = interaction.member as GuildMember;
        if (!clearMember || !clearMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          await interaction.reply({ content: '❌ You do not have permission to clear warnings.', ephemeral: true });
          break;
        }
        
        const cleared = await DatabaseService.clearWarning(interaction.guild.id, warningId);
        
        if (cleared) {
          await interaction.reply(`✅ Warning ${warningId} has been cleared.`);
        } else {
          await interaction.reply(`❌ Warning ${warningId} not found or already inactive.`);
        }
        break;
      
      case 'commandstats':
        const days = interaction.options.getInteger('days') || 7;
        
        const statsMember = interaction.member as GuildMember;
        if (!statsMember || !statsMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          await interaction.reply({ content: '❌ You do not have permission to view command statistics.', ephemeral: true });
          break;
        }
        
        const commandStats = await DatabaseService.getCommandStats(interaction.guild.id, days);
        
        if (commandStats.length === 0) {
          await interaction.reply(`📊 No command usage data found for the last ${days} days.`);
          break;
        }
        
        const statsDisplay = commandStats
          .slice(0, 15)
          .map((stat, index) => `${index + 1}. **${stat.commandName}** - ${stat.count} uses`)
          .join('\n');
        
        await interaction.reply(`
📊 **Command Usage Statistics (Last ${days} days)**
${statsDisplay}
        `);
        break;
      
      default:
        await interaction.reply('❓ Unknown command.');
    }
  } catch (error) {
    console.error('Error handling slash command:', error);
    
    // Log failed command
    await DatabaseService.logCommand(interaction.guild.id, {
      commandName: interaction.commandName,
      userId: interaction.user.id,
      username: interaction.user.displayName,
      channelId: interaction.channel?.id || 'unknown',
      timestamp: new Date().toISOString(),
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    
    if (!interaction.replied) {
      await interaction.reply('❌ Something went wrong while processing your command.');
    }
  }
}

// Bot event handlers
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`🤖 Bot logged in as ${readyClient.user.tag}`);
  await registerSlashCommands();
});

client.on(Events.MessageCreate, handleAttentionCommand);
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    await handleSlashCommand(interaction);
  }
});

// Error handling
client.on('error', console.error);
process.on('unhandledRejection', console.error);

// Start the bot
async function start() {
  await initializeDatabase();
  await client.login(TOKEN);
}

start().catch(console.error);
