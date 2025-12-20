# Minimal Discord Bot

A simplified, working version of the self-editing Discord bot that focuses on basic functionality without the complexity of the full system.

## Features

- ✅ Discord client connection and basic message handling
- ✅ Health server running on port 8080
- ✅ Basic commands: `!help`, `!ping`, `!status`, `!health`
- ✅ Graceful shutdown handling
- ✅ Error handling and logging
- ✅ Memory and system monitoring

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   # Copy .env.example to .env and add your Discord token
   cp .env.example .env
   # Edit .env and add your DISCORD_TOKEN
   ```

3. **Run the minimal bot:**
   ```bash
   npm run minimal
   ```

## Available Commands

- `!help` - Shows available commands and bot information
- `!ping` - Tests bot responsiveness and shows Discord API latency
- `!status` - Displays bot status, guild count, uptime, and memory usage
- `!health` - Shows detailed health check results

## Health Endpoints

The bot includes a health server that runs on port 8080:

- `http://localhost:8080/` - Basic bot information
- `http://localhost:8080/health` - Detailed health status

## Architecture

The minimal bot consists of:

1. **SimpleLogger** - Basic logging functionality
2. **SimpleHealthService** - Health check management
3. **HealthServer** - Express server for health endpoints
4. **MinimalDiscordBot** - Main bot class with Discord integration

## Key Differences from Full Bot

This minimal version removes:
- Complex lifecycle managers and orchestrators
- Connection circuit breakers and retry logic
- Advanced AI integration and self-editing capabilities
- Database and storage dependencies
- Rate limiting and middleware
- Complex error recovery systems

What it keeps:
- Core Discord.js integration
- Basic command handling
- Health monitoring
- Graceful shutdown
- Simple logging

## Development

To modify the minimal bot:

1. Edit `src/minimal-bot.ts`
2. Run `npm run minimal` to test changes
3. The bot will automatically recompile and restart

## Environment Variables

Required:
- `DISCORD_TOKEN` - Your Discord bot token

Optional:
- `NODE_ENV` - Environment (default: development)
- `HTTP_PORT` - Health server port (default: 8080)
- `HTTP_HOST` - Health server host (default: 0.0.0.0)

## Troubleshooting

**Bot won't start:**
- Check that `DISCORD_TOKEN` is set in your `.env` file
- Ensure the token has proper Discord permissions
- Verify port 8080 is not already in use

**Health server not accessible:**
- Check if port 8080 is available
- Verify the bot started successfully (check console logs)
- Try accessing `http://localhost:8080/` in your browser

**Commands not working:**
- Ensure the bot has Message Content intent enabled in Discord Developer Portal
- Check that the bot has proper permissions in the server
- Verify commands are prefixed with `!`

## Next Steps

This minimal bot provides a solid foundation for:
- Adding more commands and features
- Integrating with external APIs
- Building out to the full self-editing architecture
- Testing Discord.js functionality without complexity

The minimal approach ensures you have a working, deployable bot before adding advanced features.