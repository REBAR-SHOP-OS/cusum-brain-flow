/**
 * Smart Agent Router
 * Analyzes user input and returns the best-matching agent route.
 */

interface AgentRoute {
  id: string;
  route: string;
  name: string;
  keywords: string[];
}

const agentRoutes: AgentRoute[] = [
  {
    id: "sales",
    route: "/agent/sales",
    name: "Blitz",
    keywords: [
      "sale", "sales", "lead", "leads", "pipeline", "deal", "deals", "prospect",
      "close", "closing", "proposal", "follow up", "follow-up", "crm", "client",
      "revenue", "quota", "commission", "win rate", "conversion", "cold call",
      "outreach", "pitch", "negotiate", "contract", "swapnil", "neel",
    ],
  },
  {
    id: "support",
    route: "/agent/support",
    name: "Haven",
    keywords: [
      "support", "ticket", "complaint", "issue", "help desk", "escalat",
      "customer service", "resolve", "resolution", "feedback", "satisfaction",
      "response time", "sla", "warranty", "return", "refund",
    ],
  },
  {
    id: "accounting",
    route: "/agent/accounting",
    name: "Penny",
    keywords: [
      "invoice", "invoic", "payment", "bill", "billing", "accounting",
      "receivable", "payable", "ar", "ap", "quickbooks", "tax", "expense",
      "profit", "loss", "p&l", "balance sheet", "cash flow", "overdue",
      "collection", "collections", "credit", "debit", "financial",
      "payroll", "salary", "salaries", "wage", "penny",
    ],
  },
  {
    id: "legal",
    route: "/agent/legal",
    name: "Tally",
    keywords: [
      "legal", "lawyer", "contract", "contracts", "agreement", "liability",
      "compliance", "regulation", "bylaw", "by-law", "lien", "liens",
      "construction lien", "dispute", "litigation", "court", "lawsuit",
      "ontario", "esa", "ohsa", "wsib", "permit", "zoning", "insurance",
      "terms", "conditions", "clause", "negligence", "indemnity", "tally",
    ],
  },
  {
    id: "estimating",
    route: "/agent/estimating",
    name: "Gauge",
    keywords: [
      "estimate", "estimat", "quote", "bid", "pricing", "cost",
      "takeoff", "take-off", "rebar", "barlist", "bar list", "tonnage",
      "rfq", "request for quote", "measurement", "blueprint", "drawing",
      "specification", "spec", "gauge",
    ],
  },
  {
    id: "shopfloor",
    route: "/agent/shopfloor",
    name: "Forge",
    keywords: [
      "shop floor", "shopfloor", "machine", "production", "cut", "cutting",
      "bend", "bending", "fabricat", "forge", "station", "queue",
      "cutter", "bender", "output", "scrap", "inventory", "stock",
      "material", "rebar size", "bar size", "work order",
    ],
  },
  {
    id: "delivery",
    route: "/agent/delivery",
    name: "Atlas",
    keywords: [
      "delivery", "deliveries", "dispatch", "ship", "shipping", "truck",
      "driver", "route", "pickup", "drop off", "dropoff", "logistics",
      "transit", "eta", "tracking", "packing slip", "bundle", "load",
    ],
  },
  {
    id: "email",
    route: "/agent/email",
    name: "Relay",
    keywords: [
      "email", "inbox", "mail", "gmail", "compose", "reply", "forward",
      "draft", "send email", "unread", "thread", "attachment",
    ],
  },
  {
    id: "social",
    route: "/agent/social",
    name: "Pixel",
    keywords: [
      "social media", "post", "facebook", "instagram", "linkedin", "twitter",
      "content", "schedule post", "hashtag", "engagement", "follower",
      "reel", "story", "campaign", "brand", "pixel",
    ],
  },
  {
    id: "eisenhower",
    route: "/agent/eisenhower",
    name: "Eisenhower Matrix",
    keywords: [
      "eisenhower", "eisenhower matrix", "priority matrix", "urgent important",
      "prioritize", "priority", "delegate", "eliminate", "do first",
      "urgent", "important", "quadrant", "ike",
    ],
  },
  {
    id: "data",
    route: "/agent/data",
    name: "Prism",
    keywords: [
      "data", "analytics", "report", "dashboard", "chart", "metric",
      "kpi", "trend", "insight", "analysis", "performance", "statistics",
      "number", "compare", "benchmark",
    ],
  },
  {
    id: "bizdev",
    route: "/agent/bizdev",
    name: "Buddy",
    keywords: [
      "business development", "bizdev", "partnership", "market",
      "expansion", "opportunity", "strategy", "competitor", "growth plan",
      "ontario market", "construction market", "new market",
    ],
  },
  {
    id: "webbuilder",
    route: "/agent/webbuilder",
    name: "Commet",
    keywords: [
      "website", "web", "landing page", "seo audit", "page speed",
      "ux", "ui", "design", "homepage", "web builder", "site",
      "rebar.shop website",
    ],
  },
  {
    id: "assistant",
    route: "/agent/assistant",
    name: "Vizzy",
    keywords: [
      "schedule", "calendar", "meeting", "reminder", "task", "todo",
      "to-do", "plan my day", "organize", "summarize", "brief",
      "daily", "agenda",
    ],
  },
  {
    id: "copywriting",
    route: "/agent/copywriting",
    name: "Penn",
    keywords: [
      "copy", "copywriting", "write", "writing", "blog", "article",
      "headline", "tagline", "slogan", "brochure", "ad copy",
      "press release", "newsletter", "caption",
    ],
  },
  {
    id: "talent",
    route: "/agent/talent",
    name: "Scouty",
    keywords: [
      "hire", "hiring", "recruit", "recruitment", "job", "candidate",
      "interview", "resume", "cv", "talent", "hr", "human resources",
      "onboarding", "employee", "team member", "staffing", "ohsa",
    ],
  },
  {
    id: "seo",
    route: "/agent/seo",
    name: "Seomi",
    keywords: [
      "seo", "search engine", "google search", "keyword", "ranking",
      "backlink", "organic traffic", "search console", "crawl",
      "index", "serp", "meta tag", "schema markup",
    ],
  },
  {
    id: "growth",
    route: "/agent/growth",
    name: "Gigi",
    keywords: [
      "personal development", "coaching", "motivation", "goal",
      "productivity", "habit", "mindset", "focus", "burnout",
      "work-life", "self improvement", "mentoring", "growth",
    ],
  },
];

export interface RouteResult {
  agentId: string;
  route: string;
  agentName: string;
  confidence: number;
}

export function routeToAgent(input: string): RouteResult {
  const q = input.toLowerCase().trim();

  let bestMatch: RouteResult = {
    agentId: "assistant",
    route: "/agent/assistant",
    agentName: "Vizzy",
    confidence: 0,
  };

  for (const agent of agentRoutes) {
    let score = 0;
    for (const keyword of agent.keywords) {
      if (q.includes(keyword)) {
        // Longer keyword matches = higher confidence
        score += keyword.length;
      }
    }
    if (score > bestMatch.confidence) {
      bestMatch = {
        agentId: agent.id,
        route: agent.route,
        agentName: agent.name,
        confidence: score,
      };
    }
  }

  return bestMatch;
}
