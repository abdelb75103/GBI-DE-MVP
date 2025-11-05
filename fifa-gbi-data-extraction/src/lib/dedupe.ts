import crypto from 'node:crypto';

/**
 * Normalize text for duplicate detection
 * - Convert to lowercase
 * - Strip punctuation except spaces
 * - Collapse multiple spaces to single space
 * - Trim whitespace
 * - Unicode NFKD normalization
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) {
    return '';
  }

  return text
    .normalize('NFKD') // Unicode normalization
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation, keep alphanumeric and spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Generate exact duplicate key (SHA-256 hash)
 * Based on normalized title, first author, and year
 */
export function generateDuplicateKey(
  title: string | null | undefined,
  author: string | null | undefined,
  year: string | null | undefined,
): string {
  const normalizedTitle = normalizeText(title);
  const normalizedAuthor = normalizeText(author);
  const normalizedYear = year?.trim() || '';

  const combined = `${normalizedTitle}|${normalizedAuthor}|${normalizedYear}`;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

/**
 * Calculate fuzzy title match score using token set ratio
 * Returns a score between 0 and 100
 */
export function calculateFuzzyTitleScore(title1: string | null | undefined, title2: string | null | undefined): number {
  const normalized1 = normalizeText(title1);
  const normalized2 = normalizeText(title2);

  if (!normalized1 || !normalized2) {
    return 0;
  }

  // Token set approach: split into words and compare sets
  const tokens1 = new Set(normalized1.split(' ').filter((word) => word.length > 2)); // Filter short words
  const tokens2 = new Set(normalized2.split(' ').filter((word) => word.length > 2));

  if (tokens1.size === 0 || tokens2.size === 0) {
    return 0;
  }

  // Calculate intersection and union
  const intersection = new Set([...tokens1].filter((token) => tokens2.has(token)));
  const union = new Set([...tokens1, ...tokens2]);

  // Jaccard similarity (intersection / union)
  const jaccard = intersection.size / union.size;

  // Also check substring similarity for order-dependent matching
  const longer = normalized1.length >= normalized2.length ? normalized1 : normalized2;
  const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2;
  
  let substringScore = 0;
  if (longer.includes(shorter)) {
    substringScore = (shorter.length / longer.length) * 100;
  }

  // Combine Jaccard similarity and substring matching
  const combinedScore = Math.max(jaccard * 100, substringScore);

  return Math.round(combinedScore);
}

/**
 * Categorize duplicate level based on fuzzy score
 */
export type DuplicateLevel = 'exact' | 'duplicate' | 'possible' | 'none';

export function categorizeDuplicate(score: number): DuplicateLevel {
  if (score >= 92) {
    return 'duplicate';
  }
  if (score >= 85) {
    return 'possible';
  }
  return 'none';
}

/**
 * Check if DOIs match (case-insensitive, normalized)
 */
export function doiMatches(doi1: string | null | undefined, doi2: string | null | undefined): boolean {
  if (!doi1 || !doi2) {
    return false;
  }

  const normalized1 = doi1.trim().toLowerCase().replace(/^doi:\s*/i, '');
  const normalized2 = doi2.trim().toLowerCase().replace(/^doi:\s*/i, '');

  return normalized1 === normalized2 && normalized1.length > 0;
}

