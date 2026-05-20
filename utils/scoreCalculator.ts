export const CEFR_SCORES: Record<string, number> = {
  'A1': 10,
  'A2': 15,
  'B1': 30,
  'B2': 50,
  'C1': 100,
  'C2': 200,
};

export const calculateScore = (cefrLevel: string, isSynonym: boolean, isAntonym: boolean): number => {
  const baseScore = CEFR_SCORES[cefrLevel] || 5;
  return (isSynonym || isAntonym) ? baseScore * 2 : baseScore;
};