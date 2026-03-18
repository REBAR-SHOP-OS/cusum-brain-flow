// ─── Content Strategy Data for Ontario Steels / Rebar.shop ───

// ─── Monthly Events Calendar (Canadian + Global) ───
export interface CalendarEvent {
  month: number; // 1-12
  day: number;
  name: string;
  region: "CA" | "global" | "industry";
  contentTheme: string;
  hashtags: string[];
  description: string;
}

export const yearlyEvents: CalendarEvent[] = [
  // January
  { month: 1, day: 1, name: "New Year's Day", region: "global", contentTheme: "New year goals, fresh starts in construction, project planning", hashtags: ["#NewYear", "#2026Goals", "#ConstructionSeason"], description: "Celebrated worldwide on January 1st, New Year's Day marks a fresh start. In construction, it's the perfect time to set project goals, plan budgets, and prepare for the upcoming building season. Many contractors use this time to review lessons from last year and lock in supply agreements." },
  { month: 1, day: 20, name: "Family Literacy Day (CA)", region: "CA", contentTheme: "Education in trades, mentorship, apprenticeship value", hashtags: ["#FamilyLiteracyDay", "#TradesEducation", "#Apprenticeship"], description: "Founded in 1999 by ABC Life Literacy Canada, this day promotes reading and learning as a family activity. For the trades industry, it's a chance to highlight the value of apprenticeship programs, mentorship in skilled trades, and continuing education for workers and their families." },
  // February
  { month: 2, day: 1, name: "Black History Month", region: "global", contentTheme: "Diversity in construction, celebrating builders", hashtags: ["#BlackHistoryMonth", "#DiversityInConstruction"], description: "Observed in February in Canada and the US, Black History Month celebrates the contributions and achievements of Black communities. In construction, it's an opportunity to spotlight diversity, recognize Black builders, engineers, and tradespeople who shaped our industry." },
  { month: 2, day: 14, name: "Valentine's Day", region: "global", contentTheme: "We ❤️ what we build, love for the craft", hashtags: ["#ValentinesDay", "#LoveWhatYouBuild"], description: "Valentine's Day is about expressing love and appreciation. For construction businesses, it's a creative opportunity to show love for the craft, appreciate loyal customers, and celebrate the passion your team brings to every project." },
  { month: 2, day: 17, name: "Family Day (Ontario)", region: "CA", contentTheme: "Family-owned business values, team as family", hashtags: ["#FamilyDay", "#FamilyBusiness", "#OntarioSteels"], description: "A statutory holiday in Ontario since 2008, Family Day gives families time together. For family-owned construction businesses, it's a chance to showcase family values, generational knowledge passed down in the trade, and how your team operates like a family." },
  // March
  { month: 3, day: 8, name: "International Women's Day", region: "global", contentTheme: "Women in construction & trades", hashtags: ["#IWD", "#WomenInConstruction", "#WomenInTrades"], description: "Celebrated globally on March 8th since 1911, IWD recognizes women's achievements and advocates for gender equality. In construction — where women make up only ~5% of the workforce — this day highlights female tradespeople, engineers, project managers, and leaders breaking barriers." },
  { month: 3, day: 17, name: "St. Patrick's Day", region: "global", contentTheme: "Lucky to have the best team, green builds", hashtags: ["#StPatricksDay", "#LuckyTeam"], description: "An Irish cultural celebration now observed worldwide with festivities and the color green. Construction companies can highlight team spirit ('Lucky to have the best crew!'), showcase green/sustainable building practices, and engage audiences with fun, themed content." },
  { month: 3, day: 20, name: "Nowruz (Persian New Year)", region: "global", contentTheme: "New beginnings, fresh builds, celebrating diversity in construction", hashtags: ["#Nowruz", "#PersianNewYear", "#NewBeginnings", "#ConstructionSeason"], description: "Nowruz ('New Day') is the Persian New Year, celebrated on the spring equinox (~March 20). With roots dating back over 3,000 years to ancient Persia and Zoroastrian traditions, it marks the triumph of light over darkness and the renewal of nature. Recognized by UNESCO as an Intangible Cultural Heritage of Humanity since 2009, Nowruz is celebrated by over 300 million people across Iran, Afghanistan, Tajikistan, Kurdistan, Azerbaijan, Central Asia, and diaspora communities worldwide. The Haft-sin table, fire-jumping (Chaharshanbe Suri), and family gatherings are central traditions. For the construction industry, Nowruz aligns perfectly with the spring construction season — symbolizing fresh starts, new projects, and building for the future." },
  { month: 3, day: 20, name: "First Day of Spring", region: "global", contentTheme: "Construction season kickoff, spring projects", hashtags: ["#SpringIsHere", "#ConstructionSeason", "#BuildingSeason"], description: "The vernal equinox marks the official start of spring and, in Canada, the beginning of peak construction season. After winter slowdowns, projects ramp up, crews mobilize, and material orders surge. It's the ideal time to promote ready stock and fast delivery." },
  // April
  { month: 4, day: 18, name: "Good Friday (CA)", region: "CA", contentTheme: "Reflect on safety, rest, team appreciation", hashtags: ["#GoodFriday", "#SafetyFirst"], description: "A statutory holiday across Canada, Good Friday provides a pause before the busy spring construction season. It's a thoughtful moment to reflect on workplace safety, give your team well-deserved rest, and express appreciation for the hard work that keeps projects moving." },
  { month: 4, day: 22, name: "Earth Day", region: "global", contentTheme: "Sustainable construction, recycled steel, green rebar", hashtags: ["#EarthDay", "#SustainableConstruction", "#GreenBuilding", "#RecycledSteel"], description: "First celebrated in 1970, Earth Day is now observed by over 1 billion people in 193 countries. Rebar is one of the most recycled materials on earth. Showcase your recycled steel sourcing, waste reduction practices, and commitment to green construction." },
  { month: 4, day: 28, name: "National Day of Mourning (CA)", region: "CA", contentTheme: "Workplace safety, remembering fallen workers", hashtags: ["#DayOfMourning", "#WorkplaceSafety", "#SafetyFirst"], description: "Established in 1984 by the Canadian Labour Congress, April 28th honours workers killed, injured, or made ill due to workplace hazards. Construction is one of the highest-risk industries. This is NOT a promotional day — it's for solemn remembrance and renewing commitment to zero incidents." },
  // May
  { month: 5, day: 1, name: "May Day / Workers' Day", region: "global", contentTheme: "Celebrating workers, labor strength", hashtags: ["#MayDay", "#WorkersDay", "#TradesWorkers"], description: "International Workers' Day has been celebrated on May 1st since 1889 to honour the labour movement. For construction, this day celebrates the skilled hands that build our cities — from ironworkers and rebar fabricators to crane operators and concrete finishers." },
  { month: 5, day: 5, name: "North American Occupational Safety Week", region: "CA", contentTheme: "Shop floor safety, PPE, best practices", hashtags: ["#NAOSH", "#SafetyWeek", "#WorkplaceSafety"], description: "NAOSH Week (first full week of May) promotes safety in workplaces across North America. For fabrication shops and construction sites, this is the time to run safety audits, refresh PPE training, and share safety tips. Content about daily safety practices resonates strongly." },
  { month: 5, day: 11, name: "Mother's Day", region: "global", contentTheme: "Women leaders in our company, appreciation", hashtags: ["#MothersDay", "#WomenInSteel"], description: "Celebrated on the second Sunday of May, Mother's Day honours mothers and maternal figures. For construction companies, it's a chance to spotlight women leaders, celebrate working mothers in the trades, and show the human side of your brand." },
  { month: 5, day: 19, name: "Victoria Day (CA)", region: "CA", contentTheme: "Long weekend prep, construction milestones", hashtags: ["#VictoriaDay", "#LongWeekend"], description: "Victoria Day is a Canadian statutory holiday marking the unofficial start of summer. For construction, it's a milestone checkpoint — a perfect time to showcase project progress and remind contractors to place orders before the long weekend slowdown." },
  // June
  { month: 6, day: 1, name: "Pride Month", region: "global", contentTheme: "Inclusive workplace, diversity on the jobsite", hashtags: ["#PrideMonth", "#InclusiveConstruction"], description: "June is Pride Month, commemorating the Stonewall riots of 1969 and celebrating LGBTQ+ communities worldwide. In construction — historically a conservative industry — showing support for inclusion sends a powerful message. Highlight diversity policies and create a welcoming workplace culture." },
  { month: 6, day: 15, name: "Father's Day", region: "global", contentTheme: "Fathers in trades, passing on skills", hashtags: ["#FathersDay", "#TradesmenDads"], description: "Celebrated on the third Sunday of June, Father's Day honours fathers and father figures. Many trades are passed down through generations. Share stories of family legacies in construction, fathers who taught their children the trade, and the mentorship that builds strong workers." },
  { month: 6, day: 21, name: "National Indigenous Peoples Day (CA)", region: "CA", contentTheme: "Reconciliation, indigenous construction leaders", hashtags: ["#IndigenousPeoplesDay", "#Reconciliation"], description: "June 21st recognizes and celebrates the heritage, cultures, and contributions of First Nations, Inuit, and Métis peoples in Canada. This is NOT a promotional day — it's about respectful acknowledgment, learning, and supporting reconciliation." },
  // July
  { month: 7, day: 1, name: "Canada Day", region: "CA", contentTheme: "Built in Canada, proudly Canadian steel", hashtags: ["#CanadaDay", "#BuiltInCanada", "#CanadianSteel"], description: "Canada Day celebrates the anniversary of Confederation (July 1, 1867). For Canadian steel companies, this is the ultimate 'Made in Canada' moment. Showcase Canadian-sourced materials, highlight projects that build Canadian infrastructure, and take pride in supporting the domestic economy." },
  // August
  { month: 8, day: 4, name: "Civic Holiday (Ontario)", region: "CA", contentTheme: "Summer projects showcase, mid-year wins", hashtags: ["#CivicHoliday", "#SummerBuilds"], description: "The first Monday of August is a civic holiday in Ontario. It marks the peak of summer construction season. Use this time to showcase ongoing projects, celebrate mid-year achievements, and give your team a well-earned break while highlighting progress made so far." },
  // September
  { month: 9, day: 1, name: "Labour Day (CA)", region: "CA", contentTheme: "Honouring all workers, skilled trades appreciation", hashtags: ["#LabourDay", "#SkilledTrades", "#CanadianWorkers"], description: "Labour Day (first Monday of September) honours the Canadian labour movement. It marks the unofficial end of summer and the start of the fall construction push. Celebrate your team's hard work, recognize skilled tradespeople, and gear up for the busy fall season." },
  { month: 9, day: 25, name: "National Day for Truth & Reconciliation", region: "CA", contentTheme: "Reflection, education, reconciliation", hashtags: ["#TruthAndReconciliation", "#OrangeShirtDay"], description: "September 30th (Orange Shirt Day) became a federal statutory holiday in 2021 to honour survivors of residential schools and children who never returned home. This is a solemn day of reflection — NOT for promotional content. Wear orange and share educational resources." },
  // October
  { month: 10, day: 1, name: "Construction Safety Month", region: "industry", contentTheme: "Safety innovations, PPE reminders, zero incidents", hashtags: ["#ConstructionSafetyMonth", "#SafetyFirst", "#ZeroIncidents"], description: "October is recognized as Construction Safety Month across North America. This month-long campaign focuses on fall protection, equipment safety, PPE compliance, and zero-incident goals. Share daily safety tips, showcase your protocols, and highlight your team's safety achievements." },
  { month: 10, day: 10, name: "World Mental Health Day", region: "global", contentTheme: "Mental health in construction, breaking stigma", hashtags: ["#WorldMentalHealthDay", "#ConstructionMentalHealth"], description: "Observed on October 10th, this WHO-led day raises awareness about mental health. Construction workers face disproportionately high rates of depression and anxiety. This is NOT promotional — share mental health resources and show your team it's okay to ask for help." },
  { month: 10, day: 13, name: "Thanksgiving (CA)", region: "CA", contentTheme: "Grateful for our team, clients, projects completed", hashtags: ["#Thanksgiving", "#Grateful", "#ThankYou"], description: "Canadian Thanksgiving (second Monday of October) is a time for gratitude. Express genuine thanks to your team, clients, suppliers, and partners. Highlight completed projects and reflect on the year's achievements. Authentic gratitude content performs exceptionally well on social media." },
  { month: 10, day: 31, name: "Halloween", region: "global", contentTheme: "Fun team culture, spooky good deals", hashtags: ["#Halloween", "#SpookySteelDeals"], description: "Halloween (October 31st) is a fun, creative opportunity for construction brands. Share team costume photos, 'spooky' jobsite stories, or themed promotions like 'Frighteningly Fast Delivery.' Light-hearted content humanizes your brand and boosts engagement." },
  // November
  { month: 11, day: 11, name: "Remembrance Day (CA)", region: "CA", contentTheme: "Honouring veterans, strength & sacrifice", hashtags: ["#RemembranceDay", "#LestWeForget"], description: "November 11th honours Canadian military veterans and those who died in service. Many veterans transition into construction after service. This is a solemn day — NOT for promotional content. Share a respectful tribute and honour the strength and sacrifice of those who served." },
  { month: 11, day: 28, name: "Black Friday", region: "global", contentTheme: "Ready stock urgency, bulk deals, limited-time offers", hashtags: ["#BlackFriday", "#RebarDeals", "#BulkSteel"], description: "Black Friday is the biggest shopping event of the year. For B2B construction suppliers, adapt this with urgency-driven messaging: limited-time bulk pricing, ready-stock promotions, and year-end clearance deals. Contractors planning for spring projects often lock in materials at year-end discounts." },
  { month: 11, day: 29, name: "Small Business Saturday", region: "global", contentTheme: "Support local, small business values", hashtags: ["#SmallBusinessSaturday", "#ShopLocal", "#SupportLocal"], description: "Created by American Express in 2010, Small Business Saturday encourages shopping at local businesses. For independent steel suppliers, highlight your local roots, community involvement, personalized service, and how supporting local businesses strengthens the economy." },
  // December
  { month: 12, day: 2, name: "Cyber Monday", region: "global", contentTheme: "Online ordering, digital tools for contractors", hashtags: ["#CyberMonday", "#OrderOnline"], description: "Cyber Monday focuses on online deals. For construction suppliers with e-commerce (like rebar.shop), promote online ordering, digital quoting tools, and the convenience of ordering materials from the office or jobsite. Highlight real-time inventory and instant quotes." },
  { month: 12, day: 25, name: "Christmas Day", region: "global", contentTheme: "Season's greetings, year in review, team celebration", hashtags: ["#MerryChristmas", "#HappyHolidays", "#YearInReview"], description: "Christmas Day is celebrated worldwide on December 25th. For construction businesses, it's time for heartfelt season's greetings, a year-in-review highlighting major projects and milestones, and celebrating your team. Share a holiday message and express gratitude to clients and partners." },
  { month: 12, day: 31, name: "New Year's Eve", region: "global", contentTheme: "Year wrap-up, top projects, goals for next year", hashtags: ["#NewYearsEve", "#YearInReview", "#ReadyFor2027"], description: "The last day of the year is perfect for reflection and forward-looking content. Share your company's top achievements, biggest projects completed, growth milestones, and goals for the coming year. 'Year in Review' posts generate high engagement." },
];

// ─── 5 Content Pillars ───
export interface ContentPillar {
  id: string;
  name: string;
  emoji: string;
  description: string;
  exampleTopics: string[];
  ctaExamples: string[];
  color: string; // tailwind class
}

export const contentPillars: ContentPillar[] = [
  {
    id: "ready-stock",
    name: "Ready Stock & Urgency",
    emoji: "📦",
    description: "Showcase available inventory, highlight quick turnaround, and create urgency for ordering.",
    exampleTopics: [
      "What's in stock right now",
      "Same-day pickup availability",
      "Bulk order savings",
      "New stock arrivals",
      "Limited inventory alerts",
    ],
    ctaExamples: [
      "Call now to reserve your order → (416) XXX-XXXX",
      "Visit rebar.shop to check availability",
      "DM us for a quick quote",
    ],
    color: "from-orange-500 to-red-500",
  },
  {
    id: "problem-solution",
    name: "Problem → Solution",
    emoji: "🔧",
    description: "Address common pain points contractors face and position Ontario Steels as the solution.",
    exampleTopics: [
      "Waiting weeks for rebar? We have it now.",
      "Wrong sizes delivered? Our QC process",
      "Project delays from bad scheduling",
      "How we cut waste with precision cutting",
      "Before/after jobsite transformations",
    ],
    ctaExamples: [
      "Tired of delays? Let's fix that → rebar.shop",
      "Send us your barlist, we'll handle the rest",
      "Book a free consultation",
    ],
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: "testimonials",
    name: "Testimonials & Social Proof",
    emoji: "⭐",
    description: "Share customer success stories, project spotlights, and trust-building content.",
    exampleTopics: [
      "Client project spotlight",
      "Video testimonials from contractors",
      "Before/after project shots",
      "Repeat customer features",
      "Google review highlights",
    ],
    ctaExamples: [
      "Join 500+ happy contractors → rebar.shop",
      "See what our clients say about us",
      "Ready for the Ontario Steels difference?",
    ],
    color: "from-yellow-500 to-amber-500",
  },
  {
    id: "team-culture",
    name: "Team & Culture",
    emoji: "👷",
    description: "Humanize the brand by showcasing the people behind the product.",
    exampleTopics: [
      "Meet the team Monday",
      "Behind-the-scenes shop floor",
      "Safety award celebrations",
      "New hire welcomes",
      "Team building events",
      "Apprentice spotlights",
    ],
    ctaExamples: [
      "Want to join our team? Check our careers page",
      "Follow us for more behind-the-scenes",
      "Tag someone who'd love this job!",
    ],
    color: "from-green-500 to-emerald-500",
  },
  {
    id: "innovation",
    name: "Innovation & Industry Insights",
    emoji: "💡",
    description: "Position Ontario Steels as a thought leader with technical content and industry news.",
    exampleTopics: [
      "New machine capabilities",
      "Industry trend breakdowns",
      "Tech in modern rebar fabrication",
      "Sustainability in steel",
      "Code compliance updates",
      "AI in fabrication",
    ],
    ctaExamples: [
      "Learn more about our process → rebar.shop",
      "Follow for weekly industry insights",
      "Questions? Our team is here to help",
    ],
    color: "from-purple-500 to-violet-500",
  },
];

// ─── Weekly Posting Schedule (5 posts/week) ───
export interface WeekdayTheme {
  day: string;
  dayShort: string;
  dayIndex: number; // 0=Sun, 1=Mon ...
  theme: string;
  pillarId: string;
  bestTimes: Record<string, string>; // platform → best time
  description: string;
}

export const weeklySchedule: WeekdayTheme[] = [
  {
    day: "Monday",
    dayShort: "Mon",
    dayIndex: 1,
    theme: "Motivation Monday",
    pillarId: "team-culture",
    bestTimes: { instagram: "7:00 AM", facebook: "9:00 AM", linkedin: "8:00 AM", tiktok: "10:00 AM", youtube: "2:00 PM" },
    description: "Start the week strong with team spotlights, motivational quotes, or weekly goals.",
  },
  {
    day: "Tuesday",
    dayShort: "Tue",
    dayIndex: 2,
    theme: "Tech Tuesday",
    pillarId: "innovation",
    bestTimes: { instagram: "11:00 AM", facebook: "1:00 PM", linkedin: "10:00 AM", tiktok: "12:00 PM", youtube: "3:00 PM" },
    description: "Showcase technology, machines, or industry innovations.",
  },
  {
    day: "Wednesday",
    dayShort: "Wed",
    dayIndex: 3,
    theme: "Inventory Wednesday",
    pillarId: "ready-stock",
    bestTimes: { instagram: "12:00 PM", facebook: "11:00 AM", linkedin: "12:00 PM", tiktok: "7:00 PM", youtube: "2:00 PM" },
    description: "Highlight available stock, new arrivals, and urgency messaging.",
  },
  {
    day: "Thursday",
    dayShort: "Thu",
    dayIndex: 4,
    theme: "Throwback Thursday / Testimonial",
    pillarId: "testimonials",
    bestTimes: { instagram: "2:00 PM", facebook: "3:00 PM", linkedin: "1:00 PM", tiktok: "5:00 PM", youtube: "4:00 PM" },
    description: "Share client testimonials, project throwbacks, or success stories.",
  },
  {
    day: "Friday",
    dayShort: "Fri",
    dayIndex: 5,
    theme: "Fix-It Friday",
    pillarId: "problem-solution",
    bestTimes: { instagram: "11:00 AM", facebook: "10:00 AM", linkedin: "9:00 AM", tiktok: "3:00 PM", youtube: "1:00 PM" },
    description: "Address a common contractor pain point and show how you solve it.",
  },
];

// ─── Platform Breakdown ───
export interface PlatformStrategy {
  platform: string;
  icon: string;
  postsPerWeek: number;
  contentMix: string[];
  bestTimeGeneral: string;
  toneGuide: string;
  maxLength: number;
  notes: string;
}

export const platformStrategies: PlatformStrategy[] = [
  {
    platform: "Instagram",
    icon: "📸",
    postsPerWeek: 5,
    contentMix: ["Reels (40%)", "Carousels (30%)", "Single image (20%)", "Stories (daily)"],
    bestTimeGeneral: "11 AM – 1 PM EST",
    toneGuide: "Visual-first, engaging captions, 5-10 hashtags, emoji-friendly",
    maxLength: 2200,
    notes: "Real photos only. Reels perform best. Use location tags for Ontario.",
  },
  {
    platform: "TikTok",
    icon: "🎵",
    postsPerWeek: 4,
    contentMix: ["Problem-solution hooks (50%)", "Behind-the-scenes (25%)", "Trending sounds (25%)"],
    bestTimeGeneral: "12 PM – 5 PM EST",
    toneGuide: "Casual, hook-driven, trending, under 60 seconds ideal",
    maxLength: 4000,
    notes: "Your best performer. Focus on hook in first 3 seconds. Problem-solution format works best.",
  },
  {
    platform: "LinkedIn",
    icon: "💼",
    postsPerWeek: 3,
    contentMix: ["Thought leadership (40%)", "Company updates (30%)", "Industry news (30%)"],
    bestTimeGeneral: "8 AM – 10 AM EST",
    toneGuide: "Professional, data-driven, industry authority",
    maxLength: 3000,
    notes: "B2B focus. Tag partners and clients. Share industry insights.",
  },
  {
    platform: "Facebook",
    icon: "📘",
    postsPerWeek: 5,
    contentMix: ["Photos (35%)", "Videos (30%)", "Links (20%)", "Events (15%)"],
    bestTimeGeneral: "9 AM – 12 PM EST",
    toneGuide: "Professional but approachable, informative, can be longer",
    maxLength: 63206,
    notes: "Best for community engagement. Use Facebook Events for open houses.",
  },
  {
    platform: "YouTube",
    icon: "🎬",
    postsPerWeek: 1,
    contentMix: ["Tutorials (40%)", "Project showcases (30%)", "Machine demos (30%)"],
    bestTimeGeneral: "2 PM – 4 PM EST",
    toneGuide: "Descriptive title, detailed description, educational",
    maxLength: 5000,
    notes: "Longer form. Shorts can supplement. SEO-optimize titles and descriptions.",
  },
];

// ─── Monthly KPI Targets ───
export interface KpiTarget {
  metric: string;
  target: string;
  icon: string;
  description: string;
}

export const monthlyKpiTargets: KpiTarget[] = [
  { metric: "New Followers", target: "550+", icon: "👥", description: "Across all platforms combined" },
  { metric: "Leads Generated", target: "28", icon: "🎯", description: "DMs, form fills, and calls from social" },
  { metric: "Total Views", target: "20,000+", icon: "👁️", description: "Combined video + post impressions" },
  { metric: "Engagement Rate", target: "4.5%+", icon: "💬", description: "Likes, comments, shares, saves" },
  { metric: "Website Clicks", target: "400+", icon: "🔗", description: "Clicks to rebar.shop from social" },
  { metric: "Posts Published", target: "22", icon: "📝", description: "~5 per week across all platforms" },
];

// ─── Implementation Checklist ───
export interface ChecklistItem {
  id: string;
  step: string;
  description: string;
  category: "setup" | "content" | "launch" | "ongoing";
}

export const implementationChecklist: ChecklistItem[] = [
  { id: "c1", step: "Connect all social accounts", description: "Link Instagram, Facebook, LinkedIn, TikTok, YouTube via Settings", category: "setup" },
  { id: "c2", step: "Upload Brand Kit", description: "Logo, fonts, brand colors, voice guidelines", category: "setup" },
  { id: "c3", step: "Set content pillars", description: "Configure the 5 pillars: Ready Stock, Problem-Solution, Testimonials, Team, Innovation", category: "setup" },
  { id: "c4", step: "Build first week's content", description: "Use auto-generate for Mon–Fri posts across all platforms", category: "content" },
  { id: "c5", step: "Review & approve posts", description: "Check AI-generated content, edit as needed, approve for scheduling", category: "content" },
  { id: "c6", step: "Gather real photos", description: "Take shop floor, team, and product photos — no AI-generated images", category: "content" },
  { id: "c7", step: "Schedule first batch", description: "Approve and schedule the first week's posts", category: "launch" },
  { id: "c8", step: "Monitor engagement", description: "Track KPIs weekly: followers, views, leads, engagement rate", category: "ongoing" },
  { id: "c9", step: "Weekly review & adjust", description: "Review what worked, adjust themes and timing", category: "ongoing" },
  { id: "c10", step: "Monthly event planning", description: "Check upcoming holidays/events and create themed content", category: "ongoing" },
];

// ─── Helpers ───

/** Get events for a given month (1-indexed) */
export function getEventsForMonth(month: number): CalendarEvent[] {
  return yearlyEvents.filter((e) => e.month === month);
}

/** Get upcoming events within the next N days from a given date */
export function getUpcomingEvents(fromDate: Date, days: number = 14): CalendarEvent[] {
  const year = fromDate.getFullYear();
  const endDate = new Date(fromDate);
  endDate.setDate(endDate.getDate() + days);

  return yearlyEvents.filter((e) => {
    const eventDate = new Date(year, e.month - 1, e.day);
    // If event already passed this year, check next year
    if (eventDate < fromDate) {
      eventDate.setFullYear(year + 1);
    }
    return eventDate >= fromDate && eventDate <= endDate;
  });
}

/** Get today's content pillar based on day of week */
export function getTodaysPillar(date: Date = new Date()): WeekdayTheme | null {
  const dayIndex = date.getDay(); // 0=Sun, 1=Mon...
  return weeklySchedule.find((w) => w.dayIndex === dayIndex) || null;
}
