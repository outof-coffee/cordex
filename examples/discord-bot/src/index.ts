import { Client, GatewayIntentBits, Events, Message, ChatInputCommandInteraction, SlashCommandBuilder, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { repository } from '@outof-coffee/discord-wheel';
import { DatabaseService } from './database';

config();

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = process.env.COMMAND_PREFIX || '!';
const TEST_GUILD_ID = process.env.TEST_GUILD_ID;

if (!TOKEN) {
  console.error('DISCORD_TOKEN is required in environment variables');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

async function initializeDatabase() {
  try {
    await repository.initialize({
      databasePath: './data/bot-database.json'
    });
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

async function registerSlashCommands() {
  if (!TEST_GUILD_ID) {
    console.log('⚠️  TEST_GUILD_ID not set, skipping guild command registration');
    return;
  }

  const commands = [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('Test bot responsiveness'),

    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Show available commands'),

    new SlashCommandBuilder()
      .setName('profile')
      .setDescription('View user profile (works in DMs and servers)')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to view (defaults to you)')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Show top users by experience (server only)')
      .addIntegerOption(option =>
        option.setName('limit')
          .setDescription('Number of users to show (1-10)')
          .setMinValue(1)
          .setMaxValue(10)
          .setRequired(false)
      ),
  ];

  try {
    const rest = new REST().setToken(TOKEN!);
    console.log('🔄 Registering guild slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(client.user!.id, TEST_GUILD_ID),
      { body: commands.map(cmd => cmd.toJSON()) }
    );

    console.log('✅ Guild slash commands registered');
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
  }
}

async function handlePrefixCommand(message: Message) {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  const contextId = DatabaseService.getContextId(message.guild?.id || null, message.author.id);

  try {
    await DatabaseService.awardExperience(contextId, message.author.id, message.author.displayName);

    switch (command) {
      case 'ping':
        await message.reply('Pong! 🏓');
        break;

      case 'help':
        const helpText = message.guild
          ? `**Available Commands:**
Prefix Commands (${PREFIX}):
• \`${PREFIX}ping\` - Test bot responsiveness
• \`${PREFIX}help\` - Show this help message
• \`${PREFIX}profile [@user]\` - View user profile
• \`${PREFIX}leaderboard [limit]\` - Show top users (server only)

Slash Commands (/):
• \`/ping\` - Test bot responsiveness
• \`/help\` - Show available commands
• \`/profile [user]\` - View user profile (works in DMs!)
• \`/leaderboard [limit]\` - Show top users`
          : `**Available Commands (DM):**
Prefix Commands (${PREFIX}):
• \`${PREFIX}ping\` - Test bot responsiveness
• \`${PREFIX}help\` - Show this help message
• \`${PREFIX}profile\` - View your personal profile

Slash Commands (/):
• \`/ping\` - Test bot responsiveness
• \`/help\` - Show available commands
• \`/profile\` - View your personal profile

💡 Your profile data is stored personally (not per-server)`;

        await message.reply(helpText);
        break;

      case 'profile':
        const targetUser = message.mentions.users.first() || message.author;
        const profile = await DatabaseService.getOrCreateUserProfile(
          contextId,
          targetUser.id,
          targetUser.displayName
        );

        const context = profile.isPersonal() ? '(Personal Profile)' : '(Server Profile)';

        await message.reply(`
📊 **Profile for ${targetUser.displayName}** ${context}
🎯 Level: ${profile.level}
⭐ Experience: ${profile.experience}
📅 Created: ${new Date(profile.createdAt).toLocaleDateString()}
        `);
        break;

      case 'leaderboard':
        if (!message.guild) {
          await message.reply('❌ Leaderboard is only available in servers');
          break;
        }

        const limit = parseInt(args[0]) || 10;
        const topUsers = await DatabaseService.getTopUsers(message.guild.id, Math.min(limit, 10));

        if (topUsers.length === 0) {
          await message.reply('📊 No user data found yet!');
          break;
        }

        const leaderboard = topUsers
          .map((user, index) => `${index + 1}. **${user.username}** - Level ${user.level} (${user.experience} XP)`)
          .join('\n');

        await message.reply(`
🏆 **Leaderboard - Top ${topUsers.length} Users**
${leaderboard}
        `);
        break;

      default:
        await message.reply(`❓ Unknown command. Use \`${PREFIX}help\` for available commands.`);
    }
  } catch (error) {
    console.error('Error handling prefix command:', error);
    await message.reply('❌ Something went wrong.');
  }
}

async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  const contextId = DatabaseService.getContextId(interaction.guild?.id || null, interaction.user.id);

  try {
    await DatabaseService.awardExperience(contextId, interaction.user.id, interaction.user.displayName);

    switch (interaction.commandName) {
      case 'ping':
        await interaction.reply('Pong! 🏓');
        break;

      case 'help':
        const helpText = interaction.guild
          ? `**Available Commands:**
Prefix Commands (${PREFIX}):
• \`${PREFIX}ping\` - Test bot responsiveness
• \`${PREFIX}help\` - Show this help message
• \`${PREFIX}profile [@user]\` - View user profile
• \`${PREFIX}leaderboard [limit]\` - Show top users (server only)

Slash Commands (/):
• \`/ping\` - Test bot responsiveness
• \`/help\` - Show available commands
• \`/profile [user]\` - View user profile (works in DMs!)
• \`/leaderboard [limit]\` - Show top users`
          : `**Available Commands (DM):**
Slash Commands (/):
• \`/ping\` - Test bot responsiveness
• \`/help\` - Show available commands
• \`/profile\` - View your personal profile

💡 Your profile data is stored personally (not per-server)
💡 You can also use prefix commands like \`${PREFIX}profile\``;

        await interaction.reply(helpText);
        break;

      case 'profile':
        const user = interaction.options.getUser('user') || interaction.user;
        const profile = await DatabaseService.getOrCreateUserProfile(
          contextId,
          user.id,
          user.displayName
        );

        const context = profile.isPersonal() ? '(Personal Profile)' : '(Server Profile)';

        await interaction.reply(`
📊 **Profile for ${user.displayName}** ${context}
🎯 Level: ${profile.level}
⭐ Experience: ${profile.experience}
📅 Created: ${new Date(profile.createdAt).toLocaleDateString()}
        `);
        break;

      case 'leaderboard':
        if (!interaction.guild) {
          await interaction.reply('❌ Leaderboard is only available in servers');
          break;
        }

        const limit = interaction.options.getInteger('limit') || 10;
        const topUsers = await DatabaseService.getTopUsers(interaction.guild.id, Math.min(limit, 10));

        if (topUsers.length === 0) {
          await interaction.reply('📊 No user data found yet!');
          break;
        }

        const leaderboard = topUsers
          .map((user, index) => `${index + 1}. **${user.username}** - Level ${user.level} (${user.experience} XP)`)
          .join('\n');

        await interaction.reply(`
🏆 **Leaderboard - Top ${topUsers.length} Users**
${leaderboard}
        `);
        break;

      default:
        await interaction.reply('❓ Unknown command.');
    }
  } catch (error) {
    console.error('Error handling slash command:', error);
    if (!interaction.replied) {
      await interaction.reply('❌ Something went wrong.');
    }
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`🤖 Bot logged in as ${readyClient.user.tag}`);
  await registerSlashCommands();
  console.log('💡 Try DMing the bot with /profile or !profile');
});

client.on(Events.MessageCreate, handlePrefixCommand);
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    await handleSlashCommand(interaction);
  }
});

client.on('error', console.error);
process.on('unhandledRejection', console.error);

async function start() {
  await initializeDatabase();
  await client.login(TOKEN);
}

start().catch(console.error);
