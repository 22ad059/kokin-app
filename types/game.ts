export interface ChatMessage {
  word: string;
  translation: string;
  isUser: boolean;
  level?: string;
  /** JACET8000 リスト外のため AI が推定したレベルかどうか */
  levelEstimated?: boolean;
  score?: number;
}
