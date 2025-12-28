/**
 * String and numerical similarity algorithms
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create distance matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  // Initialize first column and row
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // Deletion
        dp[i][j - 1] + 1, // Insertion
        dp[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Calculate normalized string similarity (0-1)
 * Higher values indicate more similar strings
 */
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  return 1 - distance / maxLength;
}

/**
 * Calculate Jaccard similarity between two sets of tokens
 * Returns intersection/union ratio (0-1)
 */
export function jaccardSimilarity(tokens1: Set<string>, tokens2: Set<string>): number {
  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * Tokenize a string for comparison
 * Normalizes and splits into word tokens
 */
export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .split(/\s+/) // Split by whitespace
      .filter((token) => token.length > 1) // Remove single-char tokens
  );
}

/**
 * Calculate description similarity using Jaccard index
 */
export function descriptionSimilarity(desc1: string, desc2: string): number {
  const tokens1 = tokenize(desc1);
  const tokens2 = tokenize(desc2);

  return jaccardSimilarity(tokens1, tokens2);
}

/**
 * Calculate amount similarity (0-1)
 * Returns 1 for exact match, decreases with larger differences
 */
export function amountSimilarity(
  amount1: number,
  amount2: number,
  tolerancePercent: number = 0.01
): number {
  const abs1 = Math.abs(amount1);
  const abs2 = Math.abs(amount2);

  if (abs1 === 0 && abs2 === 0) return 1;
  if (abs1 === 0 || abs2 === 0) return 0;

  const diff = Math.abs(abs1 - abs2);
  const max = Math.max(abs1, abs2);
  const ratio = diff / max;

  // Return 1 if within tolerance, otherwise decay
  if (ratio <= tolerancePercent) return 1;

  return Math.max(0, 1 - ratio);
}

/**
 * Calculate time proximity similarity (0-1)
 * Returns 1 for same day, decreases with more days apart
 */
export function timeSimilarity(
  date1: Date,
  date2: Date,
  maxDays: number = 7
): number {
  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays === 0) return 1;
  if (diffDays >= maxDays) return 0;

  // Exponential decay
  return Math.exp(-diffDays / (maxDays / 3));
}

/**
 * Calculate composite similarity score for transactions
 */
export interface SimilarityWeights {
  amount: number;
  description: number;
  time: number;
}

const DEFAULT_WEIGHTS: SimilarityWeights = {
  amount: 0.4,
  description: 0.4,
  time: 0.2,
};

export function transactionSimilarity(
  trans1: { amount: number; description: string; date: Date },
  trans2: { amount: number; description: string; date: Date },
  weights: SimilarityWeights = DEFAULT_WEIGHTS,
  amountTolerance: number = 0.01,
  maxDays: number = 7
): number {
  const amountSim = amountSimilarity(trans1.amount, trans2.amount, amountTolerance);
  const descSim = descriptionSimilarity(trans1.description, trans2.description);
  const timeSim = timeSimilarity(trans1.date, trans2.date, maxDays);

  return (
    amountSim * weights.amount +
    descSim * weights.description +
    timeSim * weights.time
  );
}

/**
 * Find k most similar items in a list
 */
export function findKMostSimilar<T>(
  target: T,
  candidates: T[],
  k: number,
  similarityFn: (a: T, b: T) => number,
  minSimilarity: number = 0
): Array<{ item: T; similarity: number }> {
  const scored = candidates
    .map((item) => ({
      item,
      similarity: similarityFn(target, item),
    }))
    .filter(({ similarity }) => similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, k);
}
