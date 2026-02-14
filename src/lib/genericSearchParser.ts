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

/**
 * Helper: check if a date string falls within a parsed date token range
 */
export function matchesDateToken(dateStr: string, token: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);

  switch (token) {
    case "today":
      return date >= today;
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return date >= yesterday && date < today;
    }
    case "this_week": {
      const dayOfWeek = now.getDay();
      const monday = new Date(today);
      monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7));
      return date >= monday;
    }
    case "this_month": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return date >= monthStart;
    }
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3);
      const quarterStart = new Date(now.getFullYear(), q * 3, 1);
      return date >= quarterStart;
    }
    case "last_7_days": {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      return date >= d;
    }
    case "last_30_days": {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      return date >= d;
    }
    default:
      return true;
  }
}
