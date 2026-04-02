/**
 * Centralized date/time configuration utilities.
 * All functions accept an explicit timezone so they work
 * both inside React (from useWorkspaceSettings) and outside
 * with a hardcoded fallback.
 */

export const DEFAULT_TIMEZONE = "America/Toronto";
export const DEFAULT_DATE_FORMAT = "MM/dd/yyyy";
export const DEFAULT_TIME_FORMAT = "12h";

/** Common North American timezones for the settings dropdown */
export const TIMEZONE_OPTIONS = [
  { value: "America/Toronto", label: "Toronto (ET)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Chicago", label: "Chicago (CT)" },
  { value: "America/Denver", label: "Denver (MT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { value: "America/Vancouver", label: "Vancouver (PT)" },
  { value: "America/Edmonton", label: "Edmonton (MT)" },
  { value: "America/Winnipeg", label: "Winnipeg (CT)" },
  { value: "America/Halifax", label: "Halifax (AT)" },
] as const;

export const DATE_FORMAT_OPTIONS = [
  { value: "MM/dd/yyyy", label: "MM/DD/YYYY" },
  { value: "dd/MM/yyyy", label: "DD/MM/YYYY" },
  { value: "yyyy-MM-dd", label: "YYYY-MM-DD" },
] as const;

/** Returns the current date/time in the given timezone */
export function toZonedNow(tz: string = DEFAULT_TIMEZONE): Date {
  const str = new Date().toLocaleString("en-US", { timeZone: tz });
  return new Date(str);
}

/** Get current hour in the given timezone */
export function getHourInTimezone(tz: string = DEFAULT_TIMEZONE): number {
  return toZonedNow(tz).getHours();
}

/** Format a date using Intl for the given timezone */
export function formatDateInTimezone(
  date: Date | string,
  tz: string = DEFAULT_TIMEZONE,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    ...options,
  }).format(d);
}
