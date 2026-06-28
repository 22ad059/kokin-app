export interface WordEntry {
  genre: string;
  level: string;
  rank: number;
  word: string;
  pos: string;
  translation: string;
}

export interface PracticeMessage {
  word: string;
  translation: string;
  isUser: boolean;
  level?: string;
  score?: number;
}
