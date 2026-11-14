import type { ModerationResult } from '../types/moderation';
import { getDictionary } from './moderationStore';
import {
  evaluateUsernameWithDictionary,
  evaluateTextWithDictionary,
} from './moderationEngine';

export { evaluateUsernameWithDictionary, evaluateTextWithDictionary };

/**
 * Validates a candidate username against community guidelines and moderation dictionary.
 */
export function validateUsername(username: string): ModerationResult {
  return evaluateUsernameWithDictionary(username, getDictionary());
}

/**
 * Moderates general text (posts, comments, chat messages) dynamically against moderation dictionary.
 */
export function moderateText(text: string): ModerationResult {
  return evaluateTextWithDictionary(text, getDictionary());
}
