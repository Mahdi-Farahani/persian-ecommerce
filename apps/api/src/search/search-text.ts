import { normalizePersian } from '@pe/shared';

/**
 * Pure helpers shared by the search service, the admin indexer and the seed.
 * MariaDB InnoDB FULLTEXT ignores tokens shorter than
 * `innodb_ft_min_token_size` (3); short tokens fall back to LIKE matching.
 */

export const FULLTEXT_MIN_TOKEN = 3;
const MAX_TOKENS = 8;
/** Characters with a meaning in FULLTEXT boolean mode. */
const BOOLEAN_OPERATORS = /[+\-><()~*"@]/g;
/** Zero-width non-joiner: split "می‌خواهم" into searchable parts too. */
const ZWNJ = /‌/g;

export interface SearchTextInput {
  title: string;
  titleEn?: string | null;
  shortDescription?: string | null;
  brandName?: string | null;
  categoryName?: string | null;
  skus?: string[];
  attributeValues?: string[];
}

/** Normalised, de-duplicated text stored in `products.searchText`. */
export function buildSearchText(input: SearchTextInput): string {
  const parts = [
    input.title,
    input.titleEn ?? '',
    input.brandName ?? '',
    input.categoryName ?? '',
    ...(input.skus ?? []),
    ...(input.attributeValues ?? []),
    input.shortDescription ?? '',
  ];
  const seen = new Set<string>();
  const words: string[] = [];
  for (const part of parts) {
    for (const word of tokenize(part, Number.POSITIVE_INFINITY)) {
      if (!seen.has(word)) {
        seen.add(word);
        words.push(word);
      }
    }
  }
  return words.join(' ');
}

/** Normalises and splits a query into at most `max` tokens. */
export function tokenize(query: string, max = MAX_TOKENS): string[] {
  return (
    normalizePersian(query)
      .toLowerCase()
      .replace(ZWNJ, ' ')
      .replace(BOOLEAN_OPERATORS, ' ')
      // Only letters, digits, underscore and hyphen may reach the FULLTEXT
      // parser; anything else (%, quotes, punctuation) is a separator.
      .replace(/[^\p{L}\p{N}_-]+/gu, ' ')
      .split(/\s+/)
      .map((t) => t.trim().replace(/^-+|-+$/g, ''))
      .filter((t) => t.length > 0)
      .slice(0, max)
  );
}

/**
 * Boolean-mode expression: every token required, matched as a prefix so
 * partial words ("گوش" → "گوشی") work. Returns null when no token is long
 * enough for the index.
 */
export function booleanQuery(tokens: string[]): string | null {
  const usable = tokens.filter((t) => t.length >= FULLTEXT_MIN_TOKEN);
  if (usable.length === 0) return null;
  return usable.map((t) => `+${t}*`).join(' ');
}

/**
 * Relaxed expression for typo tolerance: each token is shortened to a prefix
 * (roughly 60%, at least the index minimum) and only one token is required.
 */
export function relaxedQuery(tokens: string[]): string | null {
  const prefixes = tokens
    .map((t) => t.slice(0, Math.max(FULLTEXT_MIN_TOKEN, Math.ceil(t.length * 0.6))))
    .filter((t) => t.length >= FULLTEXT_MIN_TOKEN);
  if (prefixes.length === 0) return null;
  return [...new Set(prefixes)].map((t) => `${t}*`).join(' ');
}

/** Tokens too short for the index; matched with LIKE instead. */
export function shortTokens(tokens: string[]): string[] {
  return tokens.filter((t) => t.length < FULLTEXT_MIN_TOKEN);
}
