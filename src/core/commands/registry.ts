import { BaseCommand, CommandContext, CommandResult } from './base';
import { Logger } from '../../utils/logger';
import { BotError } from '../../types';

export class CommandRegistry {
  private commands: Map<string, BaseCommand> = new Map();
  private aliases: Map<string, string> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public register(command: BaseCommand): void {
    this.commands.set(command.getName().toLowerCase(), command);
    
    // Register aliases
    const aliases = this.getCommandAliases(command.getName());
    aliases.forEach(alias => {
      this.aliases.set(alias.toLowerCase(), command.getName());
    });

    this.logger.info(`Registered command: ${command.getName()}`);
  }

  public unregister(commandName: string): boolean {
    const command = this.commands.get(commandName.toLowerCase());
    if (!command) return false;

    this.commands.delete(commandName.toLowerCase());
    
    // Remove aliases
    const aliases = this.getCommandAliases(commandName);
    aliases.forEach(alias => {
      this.aliases.delete(alias.toLowerCase());
    });

    this.logger.info(`Unregistered command: ${commandName}`);
    return true;
  }

  public getCommand(name: string): BaseCommand | undefined {
    return this.commands.get(name.toLowerCase());
  }

  public getCommandByAlias(alias: string): BaseCommand | undefined {
    return this.commands.get(alias.toLowerCase());
  }

  public getAllCommands(): BaseCommand[] {
    return Array.from(this.commands.values());
  }

  public getAllAliases(): Map<string, string> {
    const aliasMap = new Map<string, string>();
    
    this.commands.forEach((command, name) => {
      const aliases = this.getCommandAliases(name);
      aliases.forEach(alias => {
        aliasMap.set(alias, name);
      });
    });

    return aliasMap;
  }

  public async execute(context: CommandContext): Promise<CommandResult> {
    const { message, guild } = context;
    
    // Check if message is a command
    if (!message.content || !message.content.startsWith('!')) {
      return this.createCommandError('Invalid command format');
    }

    const parts = message.content.slice(1).trim().split(/\s+/);
    const commandName = parts[0]?.toLowerCase();
    
    if (!commandName) {
      return this.createCommandError('No command specified');
    }

    const command = this.getCommand(commandName) || this.getCommandByAlias(commandName);
    
    if (!command) {
      return this.createCommandError(`Unknown command: ${commandName}`);
    }

    // Check permissions
    const hasPermission = await (command as any).checkPermissions?.(context) ?? true;
    if (!hasPermission) {
      return this.createCommandErrorFromCommand(command, 'Insufficient permissions');
    }

    // Check cooldown
    const userId = context.user?.id;
    const hasCooldown = await (command as any).checkCooldown?.(userId) ?? true;
    if (!hasCooldown) {
      return this.createCommandErrorFromCommand(command, 'Command is on cooldown');
    }

    try {
      // Parse command arguments
      const args = parts.slice(1);
      
      // Execute command with proper context
      const result = await command.execute({
        message,
        guild,
        channel: context.channel,
        user: context.user,
        member: context.member,
        interaction: context.interaction,
        args,
      });

      this.logger.info(`Command ${commandName} executed by ${context.user?.tag}`);
      return result;
    } catch (error) {
      this.logger.error(`Command ${commandName} failed:`, error as Error);
      return this.createCommandErrorFromCommand(command, 'Command execution failed');
    }
  }

  private createCommandError(message: string): CommandResult {
    return {
      success: false,
      error: message,
    };
  }

  private createCommandErrorFromCommand(command: BaseCommand, message: string): CommandResult {
    return {
      success: false,
      error: message,
    };
  }

  private getCommandAliases(commandName: string): string[] {
    // In a real implementation, this would fetch from database
    // For now, return empty array
    return [];
  }
}