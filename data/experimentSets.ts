/**
 * 効果検証実験用の語セット。
 * /practice?set=<id> で開くと、設定画面を通らずにこの語だけで練習ゲームが始まる。
 * 語は JACET8000 の見出し語と同じつづりで書く（レベル・和訳はデータから引く）。
 * テストに使う語が決まったら、ここを差し替える。
 */
export interface ExperimentSet {
  /** 画面に出す名前 */
  label: string;
  /** 合否判定に使う意味ジャンル（JACET8000 の分類名） */
  genre: string;
  words: string[];
}

export const EXPERIMENT_SETS: Record<string, ExperimentSet> = {
  // ── L3〜L5 の 4 セット（各 18 語：L3 6・L4 7・L5 5）──
  // カタカナ語・中学基本語を除き、平均語長と水準別の平均 JACET 順位をセット間でそろえた。
  // 並びはレベルが固まらないよう固定のランダム順（一覧の表示順になる）。
  nature: {
    label: '自然・環境 18 語',
    genre: '自然・環境',
    words: [
      'wilderness', 'atmospheric', 'stream', 'mosquito', 'volcano', 'waterfall',
      'fauna', 'ecology', 'pond', 'cliff', 'predator', 'biodiversity',
      'greenhouse', 'habitat', 'wildlife', 'tide', 'valley', 'vegetation',
    ],
  },
  science: {
    label: '科学・技術 18 語',
    genre: '科学・技術',
    words: [
      'telescope', 'compound', 'formula', 'gravity', 'momentum', 'construct',
      'analysis', 'apparatus', 'rebuild', 'inspection', 'assemble', 'fossil',
      'element', 'fiber', 'satellite', 'patent', 'molecule', 'radiation',
    ],
  },
  people: {
    label: '職業・人物 18 語',
    genre: '職業・人物',
    words: [
      'historian', 'chemist', 'dentist', 'sailor', 'astronomer', 'priest',
      'merchant', 'detective', 'refugee', 'employer', 'economist', 'pupil',
      'composer', 'author', 'resign', 'witness', 'supervisor', 'librarian',
    ],
  },
  health: {
    label: '体・健康・医療 18 語',
    genre: '体・健康・医療',
    words: [
      'disorder', 'liver', 'prescription', 'wheelchair', 'pregnant', 'vein',
      'ambulance', 'medication', 'surgery', 'wrist', 'oxygen', 'breathe',
      'nutritional', 'nerve', 'psychology', 'lung', 'anxiety', 'diagnosis',
    ],
  },

  // ── 以前の語彙テスト（L4〜L6）に対応するセット ──
  // 語彙テスト簡易（自然・環境）の 24 語
  nature24: {
    label: '自然・環境 24 語',
    genre: '自然・環境',
    words: [
      'habitat', 'marsh', 'glacier', 'cliff', 'meadow', 'copper', 'drought', 'fungus',
      'fauna', 'coral', 'geological', 'hydrogen', 'predator', 'climatic', 'ecology', 'cave',
      'sulfur', 'vegetation', 'prey', 'tame', 'goat', 'volcano', 'creek', 'nitrogen',
    ],
  },
  // 語彙テスト簡易_食品 の 24 語
  food24: {
    label: '食べ物・飲み物 24 語',
    genre: '食べ物・飲み物',
    words: [
      'wheat', 'cuisine', 'starve', 'turkey', 'carbohydrate', 'bakery', 'conserve', 'stew',
      'beverage', 'bitter', 'oyster', 'dietary', 'pork', 'cucumber', 'calcium', 'swallow',
      'zinc', 'sodium', 'tasty', 'dough', 'vinegar', 'protein', 'garlic', 'appetite',
    ],
  },
};
