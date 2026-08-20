import type { PipelineFilterState } from "@/components/pipeline/PipelineFilters";

export interface SmartSearchResult {
  filters: Partial<PipelineFilterState>;
  textQuery: string;
  staleThresholdDays?: number;
  revenueFilter?: { op: "gt" | "lt"; value: number };
  stageFilter?: string;
}

// Stage keywords → stage id mapping (partial/fuzzy)
const STAGE_KEYWORDS: Record<string, string> = {
  "prospecting": "prospecting",
  "prospect": "prospecting",
  "new": "new",
  "telephonic": "telephonic_enquiries",
  "phone": "telephonic_enquiries",
  "qualified": "qualified",
  "rfi": "rfi",
  "proposal": "proposal",
  "qc": "qc_ben",
  "addendum": "addendums",
  "addendums": "addendums",
  "estimation": "estimation_ben",
  "hot": "hot_enquiries",
  "hot leads": "hot_enquiries",
  "hot enquiries": "hot_enquiries",
  "quotation priority": "quotation_priority",
  "quotation bids": "quotation_bids",
  "shop drawing": "shop_drawing",
  "shop drawing approval": "shop_drawing_approval",
};

interface Rule {
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => Partial<SmartSearchResult>;
}

const rules: Rule[] = [
  // Revenue: "value > 50000", "over 100k", "above 50k", "under 20k", "below 10000"
  {
    pattern: /\b(?:value\s*>\s*|over\s+|above\s+)(\d+\.?\d*)\s*k?\b/i,
    extract: (m) => {
      const raw = parseFloat(m[1]);
      const value = m[0].toLowerCase().includes("k") ? raw * 1000 : raw;
      return { revenueFilter: { op: "gt", value } };
    },
  },
  {
    pattern: /\b(?:value\s*<\s*|under\s+|below\s+)(\d+\.?\d*)\s*k?\b/i,
    extract: (m) => {
      const raw = parseFloat(m[1]);
      const value = m[0].toLowerCase().includes("k") ? raw * 1000 : raw;
      return { revenueFilter: { op: "lt", value } };
    },
  },

  // Date: multi-word first
  { pattern: /\bthis\s+quarter\b/i, extract: () => ({ filters: { creationDateRange: "this_quarter" } }) },
  { pattern: /\bthis\s+year\b/i, extract: () => ({ filters: { creationDateRange: "this_year" } }) },
  { pattern: /\bthis\s+month\b/i, extract: () => ({ filters: { creationDateRange: "this_month" } }) },
  { pattern: /\bthis\s+week\b/i, extract: () => ({ filters: { creationDateRange: "this_week" } }) },
  { pattern: /\blast\s+30\s*days?\b/i, extract: () => ({ filters: { creationDateRange: "last_30" } }) },
  { pattern: /\blast\s+7\s*days?\b/i, extract: () => ({ filters: { creationDateRange: "last_7" } }) },
  { pattern: /\blast\s+365\s*days?\b/i, extract: () => ({ filters: { creationDateRange: "last_365" } }) },
  { pattern: /\btoday\b/i, extract: () => ({ filters: { creationDateRange: "today" } }) },

  // Status
  { pattern: /\bwon\b/i, extract: () => ({ filters: { won: true } }) },
  { pattern: /\blost\b/i, extract: () => ({ filters: { lost: true } }) },
  { pattern: /\bopen\b/i, extract: () => ({ filters: { openOpportunities: true } }) },
  { pattern: /\barchived\b/i, extract: () => ({ filters: { archived: true } }) },

  // Assignment
  { pattern: /\bunassigned\b/i, extract: () => ({ filters: { unassigned: true } }) },
  { pattern: /\bmy\s+pipeline\b/i, extract: () => ({ filters: { myPipeline: true } }) },
  { pattern: /\bmy\s+leads?\b/i, extract: () => ({ filters: { myPipeline: true } }) },

  // Stale / inactive
  { pattern: /\b(?:stale|inactive|no\s+activity|stuck)\b/i, extract: () => ({ staleThresholdDays: 7 }) },

  // Stage names (multi-word first)
  { pattern: /\bhot\s+enquir(?:ies|y)\b/i, extract: () => ({ stageFilter: "hot_enquiries" }) },
  { pattern: /\bquotation\s+priority\b/i, extract: () => ({ stageFilter: "quotation_priority" }) },
  { pattern: /\bquotation\s+bids?\b/i, extract: () => ({ stageFilter: "quotation_bids" }) },
  { pattern: /\bshop\s+drawing\s+approval\b/i, extract: () => ({ stageFilter: "shop_drawing_approval" }) },
  { pattern: /\bshop\s+drawing\b/i, extract: () => ({ stageFilter: "shop_drawing" }) },
  { pattern: /\bhot\b/i, extract: () => ({ stageFilter: "hot_enquiries" }) },
  { pattern: /\bproposal\b/i, extract: () => ({ stageFilter: "proposal" }) },
  { pattern: /\bqualified\b/i, extract: () => ({ stageFilter: "qualified" }) },
  { pattern: /\brfi\b/i, extract: () => ({ stageFilter: "rfi" }) },
  { pattern: /\bprospecting\b/i, extract: () => ({ stageFilter: "prospecting" }) },
  { pattern: /\btelephonic\b/i, extract: () => ({ stageFilter: "telephonic_enquiries" }) },
  { pattern: /\bestimation\b/i, extract: () => ({ stageFilter: "estimation_ben" }) },
  { pattern: /\baddendums?\b/i, extract: () => ({ stageFilter: "addendums" }) },
];

export function parseSmartSearch(input: string): SmartSearchResult {
  const result: SmartSearchResult = {
    filters: {},
    textQuery: input,
  };

  let remaining = input;

  for (const rule of rules) {
    const match = remaining.match(rule.pattern);
    if (match) {
      const extracted = rule.extract(match);
      if (extracted.filters) {
        result.filters = { ...result.filters, ...extracted.filters };
      }
      if (extracted.staleThresholdDays !== undefined) {
        result.staleThresholdDays = extracted.staleThresholdDays;
      }
      if (extracted.revenueFilter) {
        result.revenueFilter = extracted.revenueFilter;
      }
      if (extracted.stageFilter) {
        result.stageFilter = extracted.stageFilter;
      }
      // Remove matched token
      remaining = remaining.replace(match[0], " ");
    }
  }

  result.textQuery = remaining.replace(/\s+/g, " ").trim();
  return result;
}

// Hint categories for SearchHints component
export const SEARCH_HINTS = [
  { category: "Date", suggestions: ["today", "this week", "this month", "this quarter", "last 7 days", "last 30 days"] },
  { category: "Status", suggestions: ["won", "lost", "open", "archived", "unassigned"] },
  { category: "Stage", suggestions: ["hot", "proposal", "qualified", "rfi", "prospecting", "estimation", "shop drawing"] },
  { category: "Revenue", suggestions: ["over 50k", "over 100k", "under 10k", "value > 50000"] },
  { category: "Activity", suggestions: ["stale", "inactive", "stuck"] },
];
