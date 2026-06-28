export const JACET_SCORES: Record<string, number> = {
  'Level 1': 10,
  'Level 2': 20,
  'Level 3': 40,
  'Level 4': 70,
  'Level 5': 100,
  'Level 6': 140,
  'Level 7': 180,
  'Level 8': 250,
};

export const calculateScore = (jacetLevel: string, isSynonym: boolean, isAntonym: boolean): number => {
  const baseScore = JACET_SCORES[jacetLevel] ?? 50;
  return (isSynonym || isAntonym) ? baseScore * 2 : baseScore;
};
