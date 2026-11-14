/**
 * Shared Pure Content Moderation Engine
 *
 * Used identically on the frontend (for live preview warnings) and on the backend
 * (authoritative validation before publishing posts, P2P bets, comments, and reports).
 * Zero browser-storage dependency.
 */

import type { ModerationResult, DictionaryEntry } from '../types/moderation.js';

const WORD_TO_DIGIT: Record<string, string> = {
  zero: '0', sifuri: '0', sifri: '0', oh: '0', nil: '0',
  one: '1', moja: '1',
  two: '2', mbili: '2', too: '2', twoo: '2',
  three: '3', tatu: '3', tree: '3',
  four: '4', nne: '4', fore: '4',
  five: '5', tano: '5', fiv: '5',
  six: '6', sita: '6',
  seven: '7', saba: '7', sevin: '7',
  eight: '8', nane: '8', ate: '8',
  nine: '9', tisa: '9', nayn: '9',
  ten: '10', kumi: '10',
  eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15',
  sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19',
  twenty: '20', thirty: '30', forty: '40', fifty: '50', sixty: '60', seventy: '70', eighty: '80', ninety: '90',
};

const MISLEADING_FRAUD_TERMS = [
  'sure bet', 'surebet', 'sure bets', 'sure win', 'surewin', 'sure wins',
  'fixed game', 'fixed games', 'fixed match', 'fixed matches', 'fixed pick', 'fixed picks',
  '100% sure', '100% win', '100% guaranteed', 'guaranteed win', 'guaranteed profit', 'guaranteed odds',
  'fixed odds', 'sure odds', 'sure 2 odds', 'sure 3 odds', 'sure 5 odds',
  'ht/ft fixed', 'ht-ft fixed', 'correct score fixed', 'pay after win', 'pay after',
  'double your money', 'double your mpesa', 'risk free win', 'zero risk win', 'foolproof bet',
];

const SELF_PROMOTION_TERMS = [
  'inbox me', 'dm me', 'pm me', 'reach me', 'contact me', 'whatsapp me', 'telegram me',
  'call me', 'text me', 'txt me', 'hit me up', 'message me', 'check my bio', 'follow my channel',
  'buy tips', 'buy odds', 'paid odds', 'paid tips', 'vip odds', 'vip tips',
  'join my group', 'join my channel', 'join group', 'join my vip', 'vip group', 'telegram channel', 'whatsapp group',
  't.me/', 'wa.me/', 'chat.whatsapp.com',
];

function containsDisguisedPhone(text: string): { flagged: boolean; phrases: string[] } {
  if (!text) return { flagged: false, phrases: [] };

  const lower = text.toLowerCase();
  const phrases: string[] = [];

  const phoneMatches = text.match(/(?:\+?254|0)[17][\s.\-*/_]?\d{2,3}[\s.\-*/_]?\d{2,3}[\s.\-*/_]?\d{2,3}|\b\d{3}[\s.\-*/_]?\d{3}[\s.\-*/_]?\d{3,4}\b/gi);
  if (phoneMatches) phrases.push(...phoneMatches);

  const spacedMatches = text.match(/(?:0|254|\+254)[\s.\-*/_]*[17][\s.\-*/_]*\d[\s.\-*/_]*\d[\s.\-*/_]*\d[\s.\-*/_]*\d[\s.\-*/_]*\d[\s.\-*/_]*\d[\s.\-*/_]*\d[\s.\-*/_]*\d/gi);
  if (spacedMatches) phrases.push(...spacedMatches);

  const tokens = lower.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
  let accumulatedWords: string[] = [];
  let accumulatedDigits = '';
  let numberTokenCount = 0;

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      accumulatedWords.push(token);
      accumulatedDigits += token;
      numberTokenCount++;
    } else if (WORD_TO_DIGIT[token]) {
      accumulatedWords.push(token);
      accumulatedDigits += WORD_TO_DIGIT[token];
      numberTokenCount++;
    } else {
      if (accumulatedDigits.length >= 9 && (/(?:2547|2541|07|01)\d{8}/.test(accumulatedDigits) || numberTokenCount >= 6)) {
        phrases.push(accumulatedWords.join(' '));
      }
      accumulatedWords = [];
      accumulatedDigits = '';
      numberTokenCount = 0;
    }
  }

  if (accumulatedDigits.length >= 9 && (/(?:2547|2541|07|01)\d{8}/.test(accumulatedDigits) || numberTokenCount >= 6)) {
    phrases.push(accumulatedWords.join(' '));
  }

  const unique = Array.from(new Set(phrases.filter(Boolean)));
  return { flagged: unique.length > 0, phrases: unique };
}

function containsMisleadingOrSelfPromo(text: string): { flagged: boolean; phrases: string[]; reason?: string; category?: string } {
  if (!text) return { flagged: false, phrases: [] };
  const lower = text.toLowerCase();
  const normalized = lower
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/!/g, 'i')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/0/g, 'o')
    .replace(/4/g, 'a')
    .replace(/5/g, 's');

  const strippedAlpha = normalized.replace(/[^a-z]/g, '');
  const phrases: string[] = [];
  let category: string | undefined;
  let reason: string | undefined;

  for (const term of MISLEADING_FRAUD_TERMS) {
    const termClean = term.replace(/[^a-z]/g, '');
    if (lower.includes(term) || normalized.includes(term) || (termClean.length >= 6 && strippedAlpha.includes(termClean))) {
      phrases.push(term);
      if (!category) {
        category = 'Scam & Fraud';
        reason = `Prohibited misleading or fraudulent phrase detected ("${term}"). MshindiRoom prohibits claims of sure bets, fixed games, or guaranteed wins.`;
      }
    }
  }

  for (const term of SELF_PROMOTION_TERMS) {
    const termClean = term.replace(/[^a-z]/g, '');
    if (lower.includes(term) || normalized.includes(term) || (termClean.length >= 6 && strippedAlpha.includes(termClean))) {
      phrases.push(term);
      if (!category) {
        category = 'Spam & Promotional Content';
        reason = `Self-promotion or contact solicitation is prohibited ("${term}"). Direct messaging, paid tips, or off-platform recruitment are not allowed.`;
      }
    }
  }

  const unique = Array.from(new Set(phrases.filter(Boolean)));
  return { flagged: unique.length > 0, phrases: unique, reason, category };
}

export function evaluateUsernameWithDictionary(username: string, dictionary: DictionaryEntry[]): ModerationResult {
  if (!username || username.trim().length < 3) {
    return { isAllowed: false, reason: 'Username must be at least 3 characters long.' };
  }
  if (username.trim().length > 16) {
    return { isAllowed: false, reason: 'Username cannot exceed 16 characters.' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
    return { isAllowed: false, reason: 'Username can only contain letters, numbers, and underscores.' };
  }

  const cleanUser = username.trim().toLowerCase();
  const entries = dictionary.filter((e) => e.enabled);
  for (const entry of entries) {
    const phrase = entry.phrase.toLowerCase();
    if (!phrase) continue;
    if (cleanUser.includes(phrase)) {
      if (entry.category === 'Political References' || entry.severity === 'Review Only') {
        continue;
      }
      return {
        isAllowed: false,
        reason: `Username contains prohibited term ("${phrase}") in category [${entry.category}]. Please choose a respectful handle.`,
        flaggedType: entry.category,
        flaggedPhrase: phrase,
        flaggedPhrases: [phrase],
        category: entry.category,
        severity: entry.severity,
        action: entry.action,
      };
    }
  }

  return { isAllowed: true };
}

export function evaluateTextWithDictionary(text: string, dictionary: DictionaryEntry[]): ModerationResult {
  if (!text || !text.trim()) {
    return { isAllowed: true };
  }

  const lowerText = text.toLowerCase();
  const allFlaggedPhrases: string[] = [];

  const phoneRes = containsDisguisedPhone(text);
  if (phoneRes.flagged) allFlaggedPhrases.push(...phoneRes.phrases);

  const fraudOrPromo = containsMisleadingOrSelfPromo(text);
  if (fraudOrPromo.flagged) allFlaggedPhrases.push(...fraudOrPromo.phrases);

  const entries = dictionary.filter((e) => e.enabled);
  const matchedEntries: DictionaryEntry[] = [];
  for (const entry of entries) {
    if (!entry.phrase) continue;
    if (lowerText.includes(entry.phrase.toLowerCase())) {
      matchedEntries.push(entry);
      allFlaggedPhrases.push(entry.phrase);
    }
  }

  const uniqueFlaggedPhrases = Array.from(new Set(allFlaggedPhrases.filter(Boolean)));

  if (phoneRes.flagged) {
    return {
      isAllowed: false,
      reason: 'Sharing phone numbers or direct contact info (even masked or typed as words) is prohibited by Mshindi Community Safety.',
      flaggedType: 'Personal Information',
      flaggedPhrase: uniqueFlaggedPhrases[0],
      flaggedPhrases: uniqueFlaggedPhrases,
      category: 'Personal Information',
      severity: 'High',
      action: 'Block',
    };
  }

  if (fraudOrPromo.flagged) {
    return {
      isAllowed: false,
      reason: fraudOrPromo.reason,
      flaggedType: fraudOrPromo.category,
      flaggedPhrase: uniqueFlaggedPhrases[0],
      flaggedPhrases: uniqueFlaggedPhrases,
      category: fraudOrPromo.category as any,
      severity: 'Critical',
      action: 'Block',
    };
  }

  if (matchedEntries.length === 0) {
    return { isAllowed: true };
  }

  const politicalMatches = matchedEntries.filter(
    (e) => e.category === 'Political References' || e.severity === 'Review Only'
  );
  const harmfulMatches = matchedEntries.filter(
    (e) => e.category !== 'Political References' && e.severity !== 'Review Only'
  );

  if (harmfulMatches.length > 0) {
    const topMatch = harmfulMatches[0];
    return {
      isAllowed: topMatch.action !== 'Block',
      reason: `Message flagged for [${topMatch.category}]: contains prohibited term(s).`,
      flaggedType: topMatch.category,
      flaggedPhrase: uniqueFlaggedPhrases[0],
      flaggedPhrases: uniqueFlaggedPhrases,
      category: topMatch.category,
      severity: topMatch.severity,
      action: topMatch.action,
    };
  }

  if (politicalMatches.length > 0) {
    const topPol = politicalMatches[0];
    return {
      isAllowed: true,
      requiresReview: true,
      reason: `Political content detected ("${topPol.phrase}"). Flagged for review.`,
      flaggedType: 'Political References',
      flaggedPhrase: uniqueFlaggedPhrases[0],
      flaggedPhrases: uniqueFlaggedPhrases,
      category: 'Political References',
      severity: 'Review Only',
      action: 'Review',
    };
  }

  return { isAllowed: true };
}

