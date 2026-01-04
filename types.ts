
export enum AppStep {
  INITIAL = 'INITIAL',
  PROCESSING = 'PROCESSING',
  RESULT = 'RESULT',
  CLARIFICATION_NEEDED = 'CLARIFICATION_NEEDED'
}

export type InteractionMode = 'concise' | 'detailed';

export interface GroundingLink {
  title: string;
  uri: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: number;
  groundingLinks?: GroundingLink[];
}

export interface TranslationContext {
  originalText: string;
  sourceLang: string;
  targetLang: string;
  imageDescription?: string;
}
