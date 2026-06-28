export interface ChatMessage {
  word: string;
  translation: string;
  isUser: boolean;
  level?: string;
  score?: number;
}
