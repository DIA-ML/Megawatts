const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// Create a simple test bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Create health server
const app = express();
const port = 8082;

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/ready', (req, res) => {
  res.json({
    status: client.ready ? 'ready' : 'not ready',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`Test health server running on port ${port}`);
});

// Bot login
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  
  if (message.content === '!ping') {
    message.reply('Pong!');
  }
  
  if (message.content === '!health') {
    message.reply('Bot is healthy!');
  }
});

// Login with token from environment
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN environment variable is required');
  process.exit(1);
}

client.login(token).catch(console.error);