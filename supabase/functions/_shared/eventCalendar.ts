// ─── Event Calendar for Content Generation (backend mirror of contentStrategyData.ts) ───

export interface CalendarEvent {
  month: number;
  day: number;
  name: string;
  region: "CA" | "global" | "industry";
  contentTheme: string;
  hashtags: string[];
}

/** Events that should NOT be used for promotional/advertising content */
const NON_ADVERTISABLE_EVENTS = new Set([
  "National Day of Mourning (CA)",
  "National Day for Truth & Reconciliation",
  "National Indigenous Peoples Day (CA)",
  "World Mental Health Day",
  "Remembrance Day (CA)",
]);

const yearlyEvents: CalendarEvent[] = [
  // January
  { month: 1, day: 1, name: "New Year's Day", region: "global", contentTheme: "New year goals, fresh starts in construction, project planning", hashtags: ["#NewYear", "#2026Goals", "#ConstructionSeason"] },
  { month: 1, day: 20, name: "Family Literacy Day (CA)", region: "CA", contentTheme: "Education in trades, mentorship, apprenticeship value", hashtags: ["#FamilyLiteracyDay", "#TradesEducation", "#Apprenticeship"] },
  // February
  { month: 2, day: 1, name: "Black History Month", region: "global", contentTheme: "Diversity in construction, celebrating builders", hashtags: ["#BlackHistoryMonth", "#DiversityInConstruction"] },
  { month: 2, day: 14, name: "Valentine's Day", region: "global", contentTheme: "We ❤️ what we build, love for the craft", hashtags: ["#ValentinesDay", "#LoveWhatYouBuild"] },
  { month: 2, day: 17, name: "Family Day (Ontario)", region: "CA", contentTheme: "Family-owned business values, team as family", hashtags: ["#FamilyDay", "#FamilyBusiness", "#OntarioSteels"] },
  // March
  { month: 3, day: 8, name: "International Women's Day", region: "global", contentTheme: "Women in construction & trades", hashtags: ["#IWD", "#WomenInConstruction", "#WomenInTrades"] },
  { month: 3, day: 17, name: "St. Patrick's Day", region: "global", contentTheme: "Lucky to have the best team, green builds", hashtags: ["#StPatricksDay", "#LuckyTeam"] },
  { month: 3, day: 20, name: "First Day of Spring", region: "global", contentTheme: "Construction season kickoff, spring projects", hashtags: ["#SpringIsHere", "#ConstructionSeason", "#BuildingSeason"] },
  // April
  { month: 4, day: 18, name: "Good Friday (CA)", region: "CA", contentTheme: "Reflect on safety, rest, team appreciation", hashtags: ["#GoodFriday", "#SafetyFirst"] },
  { month: 4, day: 22, name: "Earth Day", region: "global", contentTheme: "Sustainable construction, recycled steel, green rebar", hashtags: ["#EarthDay", "#SustainableConstruction", "#GreenBuilding", "#RecycledSteel"] },
  { month: 4, day: 28, name: "National Day of Mourning (CA)", region: "CA", contentTheme: "Workplace safety, remembering fallen workers", hashtags: ["#DayOfMourning", "#WorkplaceSafety", "#SafetyFirst"] },
  // May
  { month: 5, day: 1, name: "May Day / Workers' Day", region: "global", contentTheme: "Celebrating workers, labor strength", hashtags: ["#MayDay", "#WorkersDay", "#TradesWorkers"] },
  { month: 5, day: 5, name: "North American Occupational Safety Week", region: "CA", contentTheme: "Shop floor safety, PPE, best practices", hashtags: ["#NAOSH", "#SafetyWeek", "#WorkplaceSafety"] },
  { month: 5, day: 11, name: "Mother's Day", region: "global", contentTheme: "Women leaders in our company, appreciation", hashtags: ["#MothersDay", "#WomenInSteel"] },
  { month: 5, day: 19, name: "Victoria Day (CA)", region: "CA", contentTheme: "Long weekend prep, construction milestones", hashtags: ["#VictoriaDay", "#LongWeekend"] },
  // June
  { month: 6, day: 1, name: "Pride Month", region: "global", contentTheme: "Inclusive workplace, diversity on the jobsite", hashtags: ["#PrideMonth", "#InclusiveConstruction"] },
  { month: 6, day: 15, name: "Father's Day", region: "global", contentTheme: "Fathers in trades, passing on skills", hashtags: ["#FathersDay", "#TradesmenDads"] },
  { month: 6, day: 21, name: "National Indigenous Peoples Day (CA)", region: "CA", contentTheme: "Reconciliation, indigenous construction leaders", hashtags: ["#IndigenousPeoplesDay", "#Reconciliation"] },
  // July
  { month: 7, day: 1, name: "Canada Day", region: "CA", contentTheme: "Built in Canada, proudly Canadian steel", hashtags: ["#CanadaDay", "#BuiltInCanada", "#CanadianSteel"] },
  // August
  { month: 8, day: 4, name: "Civic Holiday (Ontario)", region: "CA", contentTheme: "Summer projects showcase, mid-year wins", hashtags: ["#CivicHoliday", "#SummerBuilds"] },
  // September
  { month: 9, day: 1, name: "Labour Day (CA)", region: "CA", contentTheme: "Honouring all workers, skilled trades appreciation", hashtags: ["#LabourDay", "#SkilledTrades", "#CanadianWorkers"] },
  { month: 9, day: 25, name: "National Day for Truth & Reconciliation", region: "CA", contentTheme: "Reflection, education, reconciliation", hashtags: ["#TruthAndReconciliation", "#OrangeShirtDay"] },
  // October
  { month: 10, day: 1, name: "Construction Safety Month", region: "industry", contentTheme: "Safety innovations, PPE reminders, zero incidents", hashtags: ["#ConstructionSafetyMonth", "#SafetyFirst", "#ZeroIncidents"] },
  { month: 10, day: 10, name: "World Mental Health Day", region: "global", contentTheme: "Mental health in construction, breaking stigma", hashtags: ["#WorldMentalHealthDay", "#ConstructionMentalHealth"] },
  { month: 10, day: 13, name: "Thanksgiving (CA)", region: "CA", contentTheme: "Grateful for our team, clients, projects completed", hashtags: ["#Thanksgiving", "#Grateful", "#ThankYou"] },
  { month: 10, day: 31, name: "Halloween", region: "global", contentTheme: "Fun team culture, spooky good deals", hashtags: ["#Halloween", "#SpookySteelDeals"] },
  // November
  { month: 11, day: 11, name: "Remembrance Day (CA)", region: "CA", contentTheme: "Honouring veterans, strength & sacrifice", hashtags: ["#RemembranceDay", "#LestWeForget"] },
  { month: 11, day: 28, name: "Black Friday", region: "global", contentTheme: "Ready stock urgency, bulk deals, limited-time offers", hashtags: ["#BlackFriday", "#RebarDeals", "#BulkSteel"] },
  { month: 11, day: 29, name: "Small Business Saturday", region: "global", contentTheme: "Support local, small business values", hashtags: ["#SmallBusinessSaturday", "#ShopLocal", "#SupportLocal"] },
  // December
  { month: 12, day: 2, name: "Cyber Monday", region: "global", contentTheme: "Online ordering, digital tools for contractors", hashtags: ["#CyberMonday", "#OrderOnline"] },
  { month: 12, day: 25, name: "Christmas Day", region: "global", contentTheme: "Season's greetings, year in review, team celebration", hashtags: ["#MerryChristmas", "#HappyHolidays", "#YearInReview"] },
  { month: 12, day: 31, name: "New Year's Eve", region: "global", contentTheme: "Year wrap-up, top projects, goals for next year", hashtags: ["#NewYearsEve", "#YearInReview", "#ReadyFor2027"] },
];

/** Check if an event is suitable for promotional advertising */
export function isAdvertisable(event: CalendarEvent): boolean {
  return !NON_ADVERTISABLE_EVENTS.has(event.name);
}

/** Get upcoming advertisable events within N days of the given date */
export function getUpcomingAdvertisableEvents(fromDate: Date, days: number = 7): CalendarEvent[] {
  const year = fromDate.getFullYear();
  const endDate = new Date(fromDate);
  endDate.setDate(endDate.getDate() + days);

  return yearlyEvents.filter((e) => {
    if (!isAdvertisable(e)) return false;
    const eventDate = new Date(year, e.month - 1, e.day);
    if (eventDate < fromDate) {
      eventDate.setFullYear(year + 1);
    }
    return eventDate >= fromDate && eventDate <= endDate;
  });
}

/** Build a prompt injection block for upcoming events */
export function buildEventPromptBlock(fromDate: Date, days: number = 3): string {
  const events = getUpcomingAdvertisableEvents(fromDate, days);
  if (events.length === 0) return "";

  const lines = events.map((e) => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `- ${monthNames[e.month - 1]} ${e.day}: **${e.name}** — Theme: "${e.contentTheme}" — Hashtags: ${e.hashtags.join(" ")}`;
  });

  return `\n\n## 🎉 UPCOMING EVENTS (use these for themed content!)
${lines.join("\n")}

INSTRUCTIONS: Incorporate these events into 1-2 of your posts. Tie the event theme creatively to REBAR.SHOP products and services. Keep it promotional and celebratory. Use the suggested hashtags alongside your regular ones.`;
}
