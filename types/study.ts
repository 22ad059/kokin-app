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
  /** ヒント（和訳）を見てから出した単語か */
  hinted?: boolean;
  /** つづりを1文字まちがえて直されたとき、入力されたつづり（得点は半分） */
  typedAs?: string;
}
