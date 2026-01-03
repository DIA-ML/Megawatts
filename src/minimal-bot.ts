  private async handleUser(message: Message): Promise<void> {
    const subcommands = this.parseSubcommands(message.content.toLowerCase(), 'user');
    
    if (subcommands.length === 0) {
      await message.reply('👤 **User Management**\n\nUsage: `!user <subcommand>`\n\nSubcommands:\n• `info <user>` - Get user info\n• `list` - List users');
      return;
    }

    const action = subcommands[0];
    
    switch (action) {
      case 'info':
        if (subcommands.length < 2) {
          await message.reply('❌ Usage: `!user info <user>`');
          return;
        }
        await message.reply(`👤 **User Info:** ${subcommands[1]}\n\n• ID: (placeholder)\n• Joined: ' + new Date().toISOString() + '\n• Roles: @Member\n• Status: Online\n\n*Note: This is a placeholder. Actual user info retrieval will be implemented later.*`);
        break;
      
      case 'list':
        await message.reply('👤 **Server Members:**\n\n• User1 (Online)\n• User2 (Online)\n• User3 (Idle)\n• User4 (Offline)\n\nShowing 4 of 100 members\n\n*Note: This is a placeholder. Actual user listing will be implemented later.*');
        break;
      
      default:
        await message.reply(`❌ Unknown subcommand: ${action}\n\nUse "!user" to see available subcommands.`);
    }
  }
