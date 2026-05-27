/**
 * Generic search parser for smart search across all pages.
 * Extracts date tokens and page-specific keyword tokens from natural language input.
 */

export interface KeywordRule {
  pattern: RegExp;
  key: string;
  value: string;
}

export interface GenericSearchConfig {
  keywords?: KeywordRule[];
  enableDateParsing?: boolean; // default true
}

export interface GenericSearchResult {
  tokens: Record<string, string>;
  textQuery: string;
}

const DATE_PATTERNS: { pattern: RegExp; key: string; value: string }[] = [
  { pattern: /\bthis\s+quarter\b/i, key: "date", value: "this_quarter" },
  { pattern: /\bthis\s+month\b/i, key: "date", value: "this_month" },
  { pattern: /\bthis\s+week\b/i, key: "date", value: "this_week" },
  { pattern: /\blast\s+30\s+days?\b/i, key: "date", value: "last_30_days" },
  { pattern: /\blast\s+7\s+days?\b/i, key: "date", value: "last_7_days" },
  { pattern: /\btoday\b/i, key: "date", value: "today" },
  { pattern: /\byesterday\b/i, key: "date", value: "yesterday" },
];

export function parseGenericSearch(
  input: string,
  config: GenericSearchConfig = {}
): GenericSearchResult {
  const { keywords = [], enableDateParsing = true } = config;
  const tokens: Record<string, string> = {};
  let remaining = input;

  // Apply date patterns
  if (enableDateParsing) {
    for (const { pattern, key, value } of DATE_PATTERNS) {
      if (pattern.test(remaining)) {
        tokens[key] = value;
        remaining = remaining.replace(pattern, "").trim();
      }
    }
  }

  // Apply page-specific keyword rules
  for (const { pattern, key, value } of keywords) {
    if (pattern.test(remaining)) {
      tokens[key] = value;
      remaining = remaining.replace(pattern, "").trim();
    }
  }

  // Clean up multiple spaces
  const textQuery = remaining.replace(/\s+/g, " ").trim();

  return { tokens, textQuery };
}
