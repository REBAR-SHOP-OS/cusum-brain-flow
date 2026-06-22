// Static occasion / holiday calendar for the Social Media weekly view.
// Pure presentational data — match by month/day, no year.

export type Occasion = {
  month: number; // 1-12
  day: number;   // 1-31
  name: string;
  theme?: string;
};

export const OCCASIONS: Occasion[] = [
  { month: 1,  day: 1,  name: "New Year's Day", theme: "Fresh start, new projects" },
  { month: 2,  day: 14, name: "Valentine's Day", theme: "Love & appreciation" },
  { month: 2,  day: 17, name: "Family Day (ON)", theme: "Family & community" },
  { month: 3,  day: 4,  name: "World Engineering Day", theme: "Celebrate engineers" },
  { month: 3,  day: 8,  name: "International Women's Day", theme: "Women in trades" },
  { month: 3,  day: 17, name: "St. Patrick's Day", theme: "Irish heritage" },
  { month: 3,  day: 18, name: "Global Recycling Day", theme: "Steel recycling" },
  { month: 3,  day: 20, name: "First Day of Spring", theme: "Construction season opens" },
  { month: 4,  day: 22, name: "Earth Day", theme: "Sustainability in construction" },
  { month: 5,  day: 1,  name: "Labour Day (Intl)", theme: "Honour workers" },
  { month: 5,  day: 11, name: "Mother's Day", theme: "Mothers in the trades" },
  { month: 5,  day: 19, name: "Victoria Day (CA)", theme: "Long weekend kickoff" },
  { month: 6,  day: 15, name: "Father's Day", theme: "Fathers in construction" },
  { month: 6,  day: 21, name: "National Indigenous Peoples Day (CA)", theme: "Indigenous heritage" },
  { month: 6,  day: 21, name: "Make Music Day", theme: "Music & culture" },
  { month: 7,  day: 1,  name: "Canada Day", theme: "Canadian pride" },
  { month: 8,  day: 4,  name: "Civic Holiday (CA)", theme: "Summer long weekend" },
  { month: 9,  day: 1,  name: "Labour Day (CA/US)", theme: "Honour workers" },
  { month: 9,  day: 30, name: "Truth & Reconciliation Day (CA)", theme: "Reflection & respect" },
  { month: 10, day: 13, name: "Thanksgiving (CA)", theme: "Gratitude" },
  { month: 10, day: 31, name: "Halloween", theme: "Fun & costumes" },
  { month: 11, day: 11, name: "Remembrance Day (CA)", theme: "Honour veterans" },
  { month: 11, day: 28, name: "Black Friday", theme: "Promotions" },
  { month: 12, day: 24, name: "Christmas Eve", theme: "Family time" },
  { month: 12, day: 25, name: "Christmas Day", theme: "Holiday cheer" },
  { month: 12, day: 26, name: "Boxing Day", theme: "Deals & gratitude" },
  { month: 12, day: 31, name: "New Year's Eve", theme: "Year in review" },
];

export function getOccasionFor(date: Date): Occasion | undefined {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return OCCASIONS.find((o) => o.month === m && o.day === d);
}
