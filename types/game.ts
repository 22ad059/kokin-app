export interface ChatMessage {
  word: string;
  translation: string;
  isUser: boolean;
  cefr?: string;
  score?: number;
}
