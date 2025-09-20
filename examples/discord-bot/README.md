# Discord Wheel Example Bot

A complete example Discord bot demonstrating the capabilities of the `@outof-coffee/discord-wheel` library. This bot showcases database persistence, user statistics tracking, moderation features, and both attention commands and slash commands.

## Features

### 🎮 Player Statistics System
- **Experience & Leveling**: Users gain XP by using commands and level up automatically
- **Achievement System**: Unlock achievements for reaching milestones
- **Leaderboards**: View top players by experience
- **Activity Tracking**: Monitor last activity and command usage

### ⚡ Dual Command System
- **Attention Commands**: Traditional prefix-based commands (e.g., `!stats`)
- **Slash Commands**: Modern Discord slash commands (e.g., `/stats`)
- **Local Guild Commands**: Slash commands registered only to test guild for easy development

### 🛡️ Moderation Features
- **Warning System**: Issue and manage user warnings
- **Warning Management**: Clear specific warnings or view warning history
- **Permission Checks**: Moderator-only commands with proper permission validation

### 📊 Analytics & Monitoring
- **Command Usage Tracking**: Monitor which commands are used most
- **Success/Error Logging**: Track command execution statistics
- **Administrative Insights**: View usage patterns and trends

### 💾 Database Integration
- **Persistent Storage**: All data stored using discord-wheel repository
- **Custom Entities**: Demonstrates creating custom database entities
- **Data Relationships**: Shows proper entity relationships and data modeling

## Setup Instructions

### Prerequisites
- Node.js 18.0.0 or higher
- A Discord application with bot token
- A Discord server for testing

### 1. Install Dependencies
```bash
cd examples/discord-bot
npm install
```

### 2. Configure Environment
1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your bot configuration:
   ```env
   # Discord Bot Token (get from https://discord.com/developers/applications)
   DISCORD_TOKEN=your_bot_token_here
   
   # Command Prefix for attention commands (default: !)
   COMMAND_PREFIX=!
   
   # Guild ID for testing slash commands (your test server ID)
   TEST_GUILD_ID=your_guild_id_here
   ```

### 3. Build the Project
```bash
npm run build
```

### 4. Start the Bot
```bash
npm start
```

## Available Commands

### Basic Commands
| Attention Command | Slash Command | Description |
|------------------|---------------|-------------|
| `!ping` | `/ping` | Test bot responsiveness |
| `!help` | `/help` | Show available commands |

### Statistics & Leaderboards
| Attention Command | Slash Command | Description |
|------------------|---------------|-------------|
| `!stats [@user]` | `/stats [user]` | Show player statistics |
| `!leaderboard [number]` | `/leaderboard [limit]` | Show top players by XP |

### Moderation (Moderator Only)
| Attention Command | Slash Command | Description |
|------------------|---------------|-------------|
| `!warn @user <reason>` | `/warn <user> <reason>` | Issue a warning to a user |
| `!warnings [@user]` | `/warnings [user]` | View warnings for a user |
| - | `/clearwarning <warning_id>` | Clear a specific warning |
| - | `/commandstats [days]` | View command usage statistics |

## Code Structure

### Core Files
- **`src/index.ts`** - Main bot file with Discord.js client and command handlers
- **`src/entities.ts`** - Custom database entities (PlayerStats, Warnings, etc.)
- **`src/database.ts`** - Database service layer with high-level operations

### Database Entities
- **`PlayerStats`** - User progression and activity tracking
- **`BotGuildConfig`** - Guild-specific bot configuration
- **`CommandLog`** - Command usage analytics
- **`Warning`** - Moderation warning system

### Key Features Demonstrated

#### Custom Entity Creation
```typescript
export class PlayerStats extends DiscordEntity {
  static readonly storageKey = 'player-stats';
  
  constructor(guildId: string, userId: string, username: string, stats: PlayerStatsData) {
    super(guildId);
    // ... entity implementation
  }
}
```

#### Database Operations
```typescript
// High-level database service
const stats = await DatabaseService.getOrCreatePlayerStats(guildId, userId, username);
const updatedStats = stats.addExperience(10);
await DatabaseService.updatePlayerStats(updatedStats);
```

#### Command Handler Pattern
```typescript
// Unified command handling for both attention and slash commands
switch (commandName) {
  case 'stats':
    const stats = await DatabaseService.getOrCreatePlayerStats(guildId, userId, username);
    await reply(`📊 Level: ${stats.level}, XP: ${stats.experience}`);
    break;
}
```

## Development Notes

### Database Storage
- Database file: `./data/bot-database.json`
- Automatically created on first run
- Delete the file to reset all data

### Permission System
- Moderation commands require `ModerateMembers` permission
- Slash commands use Discord's built-in permission system
- Attention commands check permissions manually

### Error Handling
- All commands wrapped in try-catch blocks
- Failed commands logged to database
- User-friendly error messages
- Detailed console logging for debugging

### Testing
- Slash commands registered only to test guild
- No global command registration for easy development
- Manual testing recommended - run commands in Discord

## Extending the Bot

This example bot provides a foundation for building more complex Discord bots using discord-wheel. You can:

1. **Add New Entities**: Create custom database entities for your specific needs
2. **Expand Commands**: Add more commands following the established patterns
3. **Add Features**: Implement welcome messages, auto-moderation, etc.
4. **Customize Permissions**: Modify permission checking logic
5. **Add Integrations**: Connect to external APIs or services

## License

This example is part of the discord-wheel library and follows the same license terms.
