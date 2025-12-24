// Utility to map a string to IntentType enum
import { IntentType } from './core/processing/types';

export function toIntentType(type: string): IntentType {
  switch (type.toLowerCase()) {
    case 'command': return IntentType.COMMAND;
    case 'question': return IntentType.QUESTION;
    case 'greeting': return IntentType.GREETING;
    case 'farewell': return IntentType.FAREWELL;
    case 'help': return IntentType.HELP;
    case 'moderation': return IntentType.MODERATION;
    case 'spam': return IntentType.SPAM;
    case 'conversation': return IntentType.CONVERSATION;
    default: return IntentType.UNKNOWN;
  }
}
