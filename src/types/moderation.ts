export type ModerationCategory =
  | 'English Profanity'
  | 'Kiswahili Profanity'
  | 'Sheng / Kenyan Slang'
  | 'Sexual Content'
  | 'Violence & Threats'
  | 'Hate Speech'
  | 'Harassment & Bullying'
  | 'Scam & Fraud'
  | 'Betting Scam Keywords'
  | 'Spam & Promotional Content'
  | 'External Links'
  | 'Personal Information'
  | 'Political References'
  | 'Drug References'
  | 'Adult Content';

export type ModerationSeverity =
  | 'Critical'
  | 'High'
  | 'Medium'
  | 'Low'
  | 'Review Only';

export type ModerationAction =
  | 'Block'
  | 'Flag'
  | 'Review'
  | 'Mask';

export interface DictionaryEntry {
  id: string;
  phrase: string;
  category: ModerationCategory;
  severity: ModerationSeverity;
  action: ModerationAction;
  enabled: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ModerationResult {
  isAllowed: boolean;
  reason?: string;
  flaggedType?: string;
  flaggedPhrase?: string;
  flaggedPhrases?: string[];
  category?: ModerationCategory;
  severity?: ModerationSeverity;
  action?: ModerationAction;
  requiresReview?: boolean;
  sanitizedText?: string;
}
