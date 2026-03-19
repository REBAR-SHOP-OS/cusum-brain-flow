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
  { month: 1, day: 1, name: "New Year's Day", region: "global", contentTheme: "New year goals, fresh starts in construction, project planning", hashtags: ["#NewYear", "#2026Goals", "#ConstructionSeason"], description: "Celebrated worldwide on January 1st, New Year's Day marks the beginning of the Gregorian calendar year. The tradition of celebrating the new year on this date was established when the Gregorian calendar was adopted in 1582. Across cultures, it symbolizes renewal, reflection on the past, and hope for the future. Festivities typically include fireworks, gatherings, and the making of resolutions." },
  { month: 1, day: 20, name: "Family Literacy Day (CA)", region: "CA", contentTheme: "Education in trades, mentorship, apprenticeship value", hashtags: ["#FamilyLiteracyDay", "#TradesEducation", "#Apprenticeship"], description: "Founded in 1999 by ABC Life Literacy Canada, Family Literacy Day is observed annually on January 27th to promote reading and learning as a shared family activity. Research shows that children who read with their families develop stronger literacy skills. The day encourages Canadians of all ages to engage in learning activities together, reinforcing the value of education across generations." },
  // February
  { month: 2, day: 1, name: "Black History Month", region: "global", contentTheme: "Diversity in construction, celebrating builders", hashtags: ["#BlackHistoryMonth", "#DiversityInConstruction"], description: "Observed throughout February in Canada and the United States, Black History Month traces its origins to 'Negro History Week,' created by historian Carter G. Woodson in 1926. Canada officially recognized Black History Month in December 1995 following a motion by the Honourable Jean Augustine. The month celebrates the contributions, achievements, and heritage of Black communities and serves as a reminder of the ongoing struggle for equality and justice." },
  { month: 2, day: 14, name: "Valentine's Day", region: "global", contentTheme: "We ❤️ what we build, love for the craft", hashtags: ["#ValentinesDay", "#LoveWhatYouBuild"], description: "Valentine's Day is celebrated on February 14th and is named after Saint Valentine, a Christian martyr from 3rd-century Rome. The holiday became associated with romantic love during the Middle Ages, particularly through the writings of Geoffrey Chaucer. Today it is observed worldwide as a day to express love and appreciation through cards, flowers, and gifts. The first commercial Valentine's Day cards appeared in the early 1800s." },
  { month: 2, day: 17, name: "Family Day (Ontario)", region: "CA", contentTheme: "Family-owned business values, team as family", hashtags: ["#FamilyDay", "#FamilyBusiness", "#OntarioSteels"], description: "Family Day became a statutory holiday in Ontario on February 18, 2008, introduced by Premier Dalton McGuinty. It was created to give families an additional day to spend together during the long stretch between New Year's Day and Good Friday. Alberta and Saskatchewan already had a similar holiday since 1990 and 2007 respectively. The holiday falls on the third Monday of February each year." },
  // March
  { month: 3, day: 8, name: "International Women's Day", region: "global", contentTheme: "Women in construction & trades", hashtags: ["#IWD", "#WomenInConstruction", "#WomenInTrades"], description: "International Women's Day has been observed on March 8th since 1911, when over one million people rallied in Austria, Denmark, Germany, and Switzerland. The day grew out of the labour and women's suffrage movements of the early 20th century. The United Nations began celebrating IWD in 1975. Each year carries a global theme focusing on gender equality, women's rights, and the recognition of women's achievements across all sectors of society." },
  { month: 3, day: 17, name: "St. Patrick's Day", region: "global", contentTheme: "Lucky to have the best team, green builds", hashtags: ["#StPatricksDay", "#LuckyTeam"], description: "St. Patrick's Day is celebrated on March 17th, the traditional death date of Saint Patrick (c. 385–461 AD), the foremost patron saint of Ireland. Born in Roman Britain, Patrick was kidnapped at age 16 and taken to Ireland as a slave. After escaping and returning years later as a missionary, he is credited with bringing Christianity to Ireland. The shamrock, which he reportedly used to explain the Holy Trinity, became a symbol of the holiday. Today, St. Patrick's Day is celebrated worldwide with parades, green attire, and Irish cultural festivities." },
  { month: 3, day: 20, name: "Nowruz (Persian New Year)", region: "global", contentTheme: "New beginnings, fresh builds, celebrating diversity in construction", hashtags: ["#Nowruz", "#PersianNewYear", "#NewBeginnings", "#ConstructionSeason"], description: "Nowruz ('New Day') is the Persian New Year, celebrated on the spring equinox (~March 20). With roots dating back over 3,000 years to ancient Persia and Zoroastrian traditions, it marks the triumph of light over darkness and the renewal of nature. Recognized by UNESCO as an Intangible Cultural Heritage of Humanity since 2009, Nowruz is celebrated by over 300 million people across Iran, Afghanistan, Tajikistan, Kurdistan, Azerbaijan, Central Asia, and diaspora communities worldwide. The Haft-sin table — seven symbolic items starting with the letter 'S' — Chaharshanbe Suri (fire-jumping on the last Wednesday before Nowruz), and Sizdah Bedar (Nature Day on the 13th day) are among its central traditions." },
  { month: 3, day: 20, name: "First Day of Spring", region: "global", contentTheme: "Construction season kickoff, spring projects", hashtags: ["#SpringIsHere", "#ConstructionSeason", "#BuildingSeason"], description: "The vernal equinox, occurring around March 20th, marks the astronomical beginning of spring in the Northern Hemisphere. On this day, the sun crosses the celestial equator moving northward, resulting in nearly equal hours of daylight and darkness. The word 'equinox' comes from the Latin 'aequinoctium,' meaning 'equal night.' Across cultures, the spring equinox has been celebrated for millennia as a time of renewal, rebirth, and the return of warmth after winter." },
  // April
  { month: 4, day: 18, name: "Good Friday (CA)", region: "CA", contentTheme: "Reflect on safety, rest, team appreciation", hashtags: ["#GoodFriday", "#SafetyFirst"], description: "Good Friday is a Christian holiday commemorating the crucifixion of Jesus Christ, observed on the Friday before Easter Sunday. It is a statutory holiday across all Canadian provinces and territories. The date changes each year as it follows the lunisolar calendar, typically falling between March 20 and April 23. The word 'Good' in the name is believed to derive from an older meaning of 'holy' or 'pious.' Many Canadians observe the day through church services, fasting, or quiet reflection." },
  { month: 4, day: 22, name: "Earth Day", region: "global", contentTheme: "Sustainable construction, recycled steel, green rebar", hashtags: ["#EarthDay", "#SustainableConstruction", "#GreenBuilding", "#RecycledSteel"], description: "Earth Day was first celebrated on April 22, 1970, when 20 million Americans took to the streets to protest environmental degradation. Founded by U.S. Senator Gaylord Nelson and inspired by the anti-war movement, it led to the creation of the Environmental Protection Agency (EPA) and the passage of the Clean Air, Clean Water, and Endangered Species Acts. Today, Earth Day is observed by over 1 billion people in 193 countries, making it the largest secular observance in the world." },
  { month: 4, day: 28, name: "National Day of Mourning (CA)", region: "CA", contentTheme: "Workplace safety, remembering fallen workers", hashtags: ["#DayOfMourning", "#WorkplaceSafety", "#SafetyFirst"], description: "Established in 1984 by the Canadian Labour Congress, the National Day of Mourning on April 28th honours workers who have been killed, injured, or suffered illness due to workplace hazards. Canada was the first country to officially recognize a day of mourning for workers. The date was chosen because it was on April 28, 1914, that the first comprehensive workers' compensation act in Canada received royal assent in Ontario. Over 80 countries now observe this day. This is a solemn day of remembrance — not for celebration or promotion." },
  // May
  { month: 5, day: 1, name: "May Day / Workers' Day", region: "global", contentTheme: "Celebrating workers, labor strength", hashtags: ["#MayDay", "#WorkersDay", "#TradesWorkers"], description: "International Workers' Day, observed on May 1st, originated from the labour union movement in the late 19th century, specifically the fight for an eight-hour workday. The date was chosen to commemorate the Haymarket affair of 1886 in Chicago, where a labour protest turned violent. In 1889, the Second International declared May 1st as International Workers' Day. Today it is a public holiday in over 80 countries and honours the contributions and rights of workers worldwide." },
  { month: 5, day: 5, name: "North American Occupational Safety Week", region: "CA", contentTheme: "Shop floor safety, PPE, best practices", hashtags: ["#NAOSH", "#SafetyWeek", "#WorkplaceSafety"], description: "North American Occupational Safety and Health (NAOSH) Week takes place during the first full week of May each year. Launched in 1997, it is a collaborative effort between Canada, the United States, and Mexico to promote workplace safety and health. The week encourages employers and employees to focus on preventing injury and illness in the workplace through education, training, and awareness campaigns." },
  { month: 5, day: 11, name: "Mother's Day", region: "global", contentTheme: "Women leaders in our company, appreciation", hashtags: ["#MothersDay", "#WomenInSteel"], description: "Mother's Day is celebrated on the second Sunday of May in Canada, the United States, and many other countries. The modern holiday was established by Anna Jarvis in 1908, who campaigned for a national day to honour mothers after her own mother's death. U.S. President Woodrow Wilson officially declared it a national holiday in 1914. The day is devoted to expressing gratitude and love for mothers and maternal figures through cards, flowers, and family gatherings." },
  { month: 5, day: 19, name: "Victoria Day (CA)", region: "CA", contentTheme: "Long weekend prep, construction milestones", hashtags: ["#VictoriaDay", "#LongWeekend"], description: "Victoria Day is a Canadian statutory holiday celebrated on the last Monday before May 25th. It was originally established in 1845 to celebrate the birthday of Queen Victoria (May 24, 1819). Since 1957, it has also served as the official birthday of the reigning Canadian monarch. Often considered the unofficial start of summer in Canada, the holiday is marked by fireworks, outdoor activities, and the opening of cottages and summer homes." },
  // June
  { month: 6, day: 1, name: "Pride Month", region: "global", contentTheme: "Inclusive workplace, diversity on the jobsite", hashtags: ["#PrideMonth", "#InclusiveConstruction"], description: "Pride Month is celebrated throughout June to honour the LGBTQ+ community and commemorate the Stonewall riots of June 28, 1969, in New York City. The riots were a pivotal moment in the fight for LGBTQ+ rights. The first Pride marches took place on June 28, 1970, in New York, Los Angeles, San Francisco, and Chicago. Today, Pride Month is observed worldwide with parades, educational events, and celebrations promoting equality, dignity, and the recognition of LGBTQ+ contributions to society." },
  { month: 6, day: 15, name: "Father's Day", region: "global", contentTheme: "Fathers in trades, passing on skills", hashtags: ["#FathersDay", "#TradesmenDads"], description: "Father's Day is celebrated on the third Sunday of June in Canada and many countries worldwide. The modern holiday was first proposed by Sonora Smart Dodd in 1910, inspired by Mother's Day, to honour her father who raised six children as a single parent. U.S. President Richard Nixon officially made it a national holiday in 1972. The day honours fathers and father figures for their love, guidance, and contribution to family life." },
  { month: 6, day: 21, name: "National Indigenous Peoples Day (CA)", region: "CA", contentTheme: "Reconciliation, indigenous construction leaders", hashtags: ["#IndigenousPeoplesDay", "#Reconciliation"], description: "June 21st is National Indigenous Peoples Day in Canada, recognizing and celebrating the heritage, diverse cultures, and outstanding contributions of First Nations, Inuit, and Métis peoples. The date was chosen because it coincides with the summer solstice, which holds great significance in many Indigenous cultures. The day was officially proclaimed by Governor General Roméo LeBlanc in 1996. This is a day for respectful acknowledgment, learning, and reflection — not for promotion." },
  // July
  { month: 7, day: 1, name: "Canada Day", region: "CA", contentTheme: "Built in Canada, proudly Canadian steel", hashtags: ["#CanadaDay", "#BuiltInCanada", "#CanadianSteel"], description: "Canada Day is celebrated on July 1st and marks the anniversary of Canadian Confederation. On this date in 1867, the British North America Act (now the Constitution Act, 1867) united three colonies — the Province of Canada, Nova Scotia, and New Brunswick — into a single Dominion within the British Empire. Originally known as 'Dominion Day,' the holiday was renamed 'Canada Day' in 1982. Celebrations typically include fireworks, parades, concerts, and community events across the country." },
  // August
  { month: 8, day: 4, name: "Civic Holiday (Ontario)", region: "CA", contentTheme: "Summer projects showcase, mid-year wins", hashtags: ["#CivicHoliday", "#SummerBuilds"], description: "The Civic Holiday is observed on the first Monday of August in Ontario and several other Canadian provinces. While not an official statutory holiday in Ontario, it is widely observed as a day off. The holiday goes by different names across Canada: Simcoe Day in Toronto (named after John Graves Simcoe, the first Lieutenant Governor of Upper Canada), British Columbia Day, Saskatchewan Day, and Heritage Day in Alberta. It provides a mid-summer break during the warmest month of the year." },
  // September
  { month: 9, day: 1, name: "Labour Day (CA)", region: "CA", contentTheme: "Honouring all workers, skilled trades appreciation", hashtags: ["#LabourDay", "#SkilledTrades", "#CanadianWorkers"], description: "Labour Day is a Canadian statutory holiday celebrated on the first Monday of September. Its origins trace back to the Toronto Typographical Union's strike for a 58-hour work week in 1872. The Toronto Trades Assembly organized the first large workers' parade on April 15, 1872. In 1894, the Canadian government officially made Labour Day a national holiday. It honours the achievements of workers and the labour movement, and is often considered the unofficial end of summer in Canada." },
  { month: 9, day: 25, name: "National Day for Truth & Reconciliation", region: "CA", contentTheme: "Reflection, education, reconciliation", hashtags: ["#TruthAndReconciliation", "#OrangeShirtDay"], description: "September 30th became a federal statutory holiday in Canada in 2021, known as the National Day for Truth and Reconciliation. It honours the survivors of residential schools and the children who never returned home. The date aligns with Orange Shirt Day, inspired by Phyllis Webstad's story of having her new orange shirt taken away on her first day at a residential school. The Truth and Reconciliation Commission of Canada documented the experiences of over 150,000 Indigenous children who were placed in residential schools. This is a solemn day for reflection and education — not for promotion." },
  // October
  { month: 10, day: 1, name: "Construction Safety Month", region: "industry", contentTheme: "Safety innovations, PPE reminders, zero incidents", hashtags: ["#ConstructionSafetyMonth", "#SafetyFirst", "#ZeroIncidents"], description: "October is recognized as Construction Safety Month across North America. The campaign was established to raise awareness about the importance of safety in one of the most hazardous industries. According to the Association of Workers' Compensation Boards of Canada, construction consistently ranks among the highest-risk sectors for workplace injuries and fatalities. The month-long campaign focuses on fall protection, equipment safety, PPE compliance, and the goal of zero workplace incidents." },
  { month: 10, day: 10, name: "World Mental Health Day", region: "global", contentTheme: "Mental health in construction, breaking stigma", hashtags: ["#WorldMentalHealthDay", "#ConstructionMentalHealth"], description: "World Mental Health Day is observed on October 10th, established by the World Federation for Mental Health in 1992 and supported by the World Health Organization (WHO). Each year carries a specific theme to raise awareness about mental health issues and mobilize support for mental health care. The day aims to reduce stigma, promote open conversation about mental health challenges, and encourage governments and organizations to invest in mental health services. This is a day for awareness and support — not for promotion." },
  { month: 10, day: 13, name: "Thanksgiving (CA)", region: "CA", contentTheme: "Grateful for our team, clients, projects completed", hashtags: ["#Thanksgiving", "#Grateful", "#ThankYou"], description: "Canadian Thanksgiving is celebrated on the second Monday of October. Its origins trace back to 1578, when English explorer Martin Frobisher held a ceremony in Newfoundland to give thanks for his safe arrival. The tradition blended with European harvest festivals and Indigenous celebrations of the autumn harvest. It became a national holiday in 1879 and has been fixed to the second Monday of October since 1957. Unlike American Thanksgiving (in November), Canadian Thanksgiving aligns more closely with the traditional European harvest season." },
  { month: 10, day: 31, name: "Halloween", region: "global", contentTheme: "Fun team culture, spooky good deals", hashtags: ["#Halloween", "#SpookySteelDeals"], description: "Halloween is celebrated on October 31st and has its roots in the ancient Celtic festival of Samhain, which marked the end of the harvest season and the beginning of winter. The Celts believed that on this night, the boundary between the living and the dead became blurred. When Christianity spread into Celtic lands, November 1st became All Saints' Day ('All Hallows' Day'), making October 31st 'All Hallows' Eve,' eventually shortened to 'Halloween.' Irish and Scottish immigrants brought the tradition to North America in the 19th century, where it evolved into the modern holiday of costumes, trick-or-treating, and jack-o'-lanterns." },
  // November
  { month: 11, day: 11, name: "Remembrance Day (CA)", region: "CA", contentTheme: "Honouring veterans, strength & sacrifice", hashtags: ["#RemembranceDay", "#LestWeForget"], description: "Remembrance Day is observed on November 11th to honour Canadian military personnel who have served and died in wars and peacekeeping missions. The date marks the end of World War I, when the armistice was signed on the 11th hour of the 11th day of the 11th month in 1918. The poppy became the symbol of remembrance, inspired by the poem 'In Flanders Fields' written by Canadian Lieutenant Colonel John McCrae in 1915. This is a solemn day of remembrance and tribute — not for promotion." },
  { month: 11, day: 28, name: "Black Friday", region: "global", contentTheme: "Ready stock urgency, bulk deals, limited-time offers", hashtags: ["#BlackFriday", "#RebarDeals", "#BulkSteel"], description: "Black Friday is the day after American Thanksgiving and has become the biggest shopping event of the year worldwide. The term was first used in Philadelphia in the 1960s to describe the heavy traffic and chaos that followed Thanksgiving. Later, it was reinterpreted as the day when retailers move from being 'in the red' (loss) to 'in the black' (profit). Since the 2000s, Black Friday has expanded globally, including to Canada, the UK, and beyond, both in physical stores and online." },
  { month: 11, day: 29, name: "Small Business Saturday", region: "global", contentTheme: "Support local, small business values", hashtags: ["#SmallBusinessSaturday", "#ShopLocal", "#SupportLocal"], description: "Small Business Saturday was created by American Express in 2010 as a response to Black Friday and Cyber Monday, encouraging consumers to shop at local, independent businesses. The initiative was officially recognized by the U.S. Senate in 2011. It highlights the importance of small businesses to local economies — in Canada and the U.S., small businesses account for the vast majority of all businesses and are significant employers. The day celebrates entrepreneurship, community roots, and personalized service." },
  // December
  { month: 12, day: 2, name: "Cyber Monday", region: "global", contentTheme: "Online ordering, digital tools for contractors", hashtags: ["#CyberMonday", "#OrderOnline"], description: "Cyber Monday was coined by the National Retail Federation in 2005 to describe the surge in online shopping on the Monday following American Thanksgiving. It was originally created because many consumers would return to work after the holiday weekend and shop online using their faster office internet connections. Cyber Monday has since grown into one of the largest online shopping days globally, reflecting the massive shift toward e-commerce and digital retail." },
  { month: 12, day: 25, name: "Christmas Day", region: "global", contentTheme: "Season's greetings, year in review, team celebration", hashtags: ["#MerryChristmas", "#HappyHolidays", "#YearInReview"], description: "Christmas Day is celebrated on December 25th by billions of people worldwide. It commemorates the birth of Jesus Christ, though the exact date of his birth is not known. The choice of December 25th is believed to have been influenced by the Roman festival of Saturnalia and the winter solstice celebrations. Modern Christmas traditions — including Christmas trees (from Germany), Santa Claus (based on Saint Nicholas), and gift-giving — developed over centuries and blend Christian, pagan, and secular customs from many cultures." },
  { month: 12, day: 31, name: "New Year's Eve", region: "global", contentTheme: "Year wrap-up, top projects, goals for next year", hashtags: ["#NewYearsEve", "#YearInReview", "#ReadyFor2027"], description: "New Year's Eve is celebrated on December 31st, the last day of the Gregorian calendar year. The tradition of celebrating the transition to a new year dates back over 4,000 years to ancient Babylon, which held an 11-day festival called Akitu. In 46 BC, Julius Caesar introduced the Julian calendar, establishing January 1st as the start of the new year. Today, New Year's Eve is marked worldwide with fireworks, countdown events, and gatherings. Iconic celebrations include Times Square in New York, Sydney Harbour in Australia, and the Champs-Élysées in Paris." },
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
