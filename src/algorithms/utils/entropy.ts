/**
 * Information entropy calculations for text analysis
 * Used to detect randomized or suspicious patterns
 */

/**
 * Calculate Shannon entropy of a string
 * Higher values indicate more randomness/complexity
 * Typical values:
 * - Low (< 2.0): Repetitive or simple text
 * - Medium (2.0 - 3.5): Normal text
 * - High (> 3.5): Random or highly varied text
 */
export function shannonEntropy(text: string): number {
  if (!text || text.length === 0) return 0;

  const charCounts = new Map<string, number>();
  const cleanText = text.toLowerCase();

  for (const char of cleanText) {
    charCounts.set(char, (charCounts.get(char) || 0) + 1);
  }

  const length = cleanText.length;
  let entropy = 0;

  for (const count of charCounts.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

/**
 * Calculate word-level entropy
 * Measures variety of words used
 */
export function wordEntropy(text: string): number {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return 0;

  const wordCounts = new Map<string, number>();

  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  }

  const totalWords = words.length;
  let entropy = 0;

  for (const count of wordCounts.values()) {
    const probability = count / totalWords;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

/**
 * Normalized entropy (0-1 scale)
 * Accounts for string length to make comparisons fair
 */
export function normalizedEntropy(text: string): number {
  if (!text || text.length <= 1) return 0;

  const entropy = shannonEntropy(text);
  const maxEntropy = Math.log2(text.length);

  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

/**
 * Check if text appears to be randomly generated
 * Based on entropy and character distribution analysis
 */
export interface RandomnessAnalysis {
  isRandom: boolean;
  entropy: number;
  normalizedEntropy: number;
  confidence: number;
  reasons: string[];
}

export function analyzeRandomness(text: string): RandomnessAnalysis {
  const reasons: string[] = [];
  let suspicionScore = 0;

  // Calculate entropy metrics
  const entropy = shannonEntropy(text);
  const normEntropy = normalizedEntropy(text);

  // High character entropy is suspicious
  if (entropy > 4.0) {
    suspicionScore += 0.3;
    reasons.push('Entropie de caractères élevée');
  }

  // Check for unusual character distribution
  const alphaRatio = countPattern(text, /[a-zA-Z]/g) / text.length;
  const digitRatio = countPattern(text, /\d/g) / text.length;
  const specialRatio = countPattern(text, /[^a-zA-Z0-9\s]/g) / text.length;

  // Suspicious if too many digits mixed with letters
  if (digitRatio > 0.3 && alphaRatio > 0.3) {
    suspicionScore += 0.2;
    reasons.push('Mélange inhabituel de chiffres et lettres');
  }

  // Suspicious if too many special characters
  if (specialRatio > 0.2) {
    suspicionScore += 0.2;
    reasons.push('Trop de caractères spéciaux');
  }

  // Check for repeating patterns
  const hasRepeatingPattern = /(.{2,})\1{2,}/.test(text);
  if (hasRepeatingPattern) {
    suspicionScore -= 0.1; // Repetition suggests non-random
  }

  // Check word frequency (real text has common words)
  const hasCommonWords = hasCommonFrenchWords(text);
  if (!hasCommonWords) {
    suspicionScore += 0.2;
    reasons.push('Absence de mots communs');
  }

  // Normalize score
  const confidence = Math.min(Math.max(suspicionScore, 0), 1);

  return {
    isRandom: confidence > 0.5,
    entropy,
    normalizedEntropy: normEntropy,
    confidence,
    reasons,
  };
}

/**
 * Count pattern occurrences
 */
function countPattern(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * Check if text contains common French words
 */
function hasCommonFrenchWords(text: string): boolean {
  const commonWords = [
    'de',
    'la',
    'le',
    'du',
    'des',
    'et',
    'en',
    'un',
    'une',
    'pour',
    'sur',
    'par',
    'avec',
    'au',
    'aux',
    'frais',
    'compte',
    'virement',
    'paiement',
    'carte',
    'retrait',
  ];

  const words = text.toLowerCase().split(/\s+/);

  return commonWords.some((common) =>
    words.some((word) => word === common || word.includes(common))
  );
}

/**
 * Calculate suspicion score for a fee description
 * Returns 0-1 where higher values are more suspicious
 */
export function feeDescriptionSuspicionScore(description: string): number {
  let score = 0;
  const lowerDesc = description.toLowerCase();

  // Suspicious patterns
  const suspiciousPatterns = [
    { pattern: /frais\s+divers/i, weight: 0.25 },
    { pattern: /commission\s+diverse/i, weight: 0.25 },
    { pattern: /autres?\s+frais/i, weight: 0.2 },
    { pattern: /prélèvement\s+auto/i, weight: 0.15 },
    { pattern: /frais\s+de\s+gestion/i, weight: 0.15 },
    { pattern: /^frais\s*$/i, weight: 0.3 },
    { pattern: /^commission\s*$/i, weight: 0.3 },
  ];

  for (const { pattern, weight } of suspiciousPatterns) {
    if (pattern.test(lowerDesc)) {
      score += weight;
    }
  }

  // Short descriptions are suspicious
  if (description.length < 15) {
    score += 0.15;
  }

  // Very generic descriptions
  if (description.length < 25 && wordEntropy(description) < 1.5) {
    score += 0.1;
  }

  // High entropy descriptions might be auto-generated
  const analysis = analyzeRandomness(description);
  if (analysis.isRandom) {
    score += 0.2;
  }

  return Math.min(score, 1);
}

/**
 * Check if amount is suspiciously round
 */
export function isRoundAmount(amount: number): boolean {
  const absAmount = Math.abs(amount);

  // Check common round amounts
  const roundPatterns = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000];

  return roundPatterns.some(
    (pattern) => absAmount % pattern === 0 && absAmount >= pattern
  );
}
