/**
 * Centralized date/time configuration utilities.
 * All functions accept an explicit timezone so they work
 * both inside React (from useWorkspaceSettings) and outside
 * with a hardcoded fallback.
 */

export const DEFAULT_TIMEZONE = "America/Toronto";
export const DEFAULT_DATE_FORMAT = "MM/dd/yyyy";
export const DEFAULT_TIME_FORMAT = "12h";
export type TimeOfDay = "morning" | "afternoon" | "evening";

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

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedDateTimeParts(
  date: Date = new Date(),
  tz: string = DEFAULT_TIMEZONE
): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const partMap = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  ) as Record<string, number>;

  return {
    year: partMap.year,
    month: partMap.month,
    day: partMap.day,
    hour: partMap.hour,
    minute: partMap.minute,
    second: partMap.second,
  };
}

function getTimezoneOffsetMs(
  date: Date = new Date(),
  tz: string = DEFAULT_TIMEZONE
): number {
  const parts = getZonedDateTimeParts(date, tz);
  const utcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return utcMs - date.getTime();
}

export function getTimezoneLabel(tz: string = DEFAULT_TIMEZONE): string {
  return TIMEZONE_OPTIONS.find((option) => option.value === tz)?.label ?? tz;
}

export function getTimezoneLocationLabel(
  tz: string = DEFAULT_TIMEZONE
): string {
  const label = getTimezoneLabel(tz);
  if (label !== tz) {
    return label.split(" (")[0];
  }

  return tz.split("/").at(-1)?.replace(/_/g, " ") ?? tz;
}

/** Returns the current date/time in the given timezone */
export function toZonedNow(
  tz: string = DEFAULT_TIMEZONE,
  date: Date = new Date()
): Date {
  const parts = getZonedDateTimeParts(date, tz);
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
}

/** Get current hour in the given timezone */
export function getHourInTimezone(
  tz: string = DEFAULT_TIMEZONE,
  date: Date = new Date()
): number {
  return getZonedDateTimeParts(date, tz).hour;
}

export function getTimeOfDayInTimezone(
  tz: string = DEFAULT_TIMEZONE,
  date: Date = new Date()
): TimeOfDay {
  const hour = getHourInTimezone(tz, date);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
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

export function getStartOfDayIsoInTimezone(
  tz: string = DEFAULT_TIMEZONE,
  date: Date = new Date()
): string {
  const parts = getZonedDateTimeParts(date, tz);
  const midnightUtcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  const offsetMs = getTimezoneOffsetMs(new Date(midnightUtcGuess), tz);
  return new Date(midnightUtcGuess - offsetMs).toISOString();
}

export function getTimeContextInTimezone(
  tz: string = DEFAULT_TIMEZONE,
  date: Date = new Date()
): {
  hour: number;
  timeOfDay: TimeOfDay;
  formattedNow: string;
  timezoneLabel: string;
  timezoneLocation: string;
} {
  return {
    hour: getHourInTimezone(tz, date),
    timeOfDay: getTimeOfDayInTimezone(tz, date),
    formattedNow: formatDateInTimezone(date, tz, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }),
    timezoneLabel: getTimezoneLabel(tz),
    timezoneLocation: getTimezoneLocationLabel(tz),
  };
}

/**
 * Returns the authoritative Toronto time string for Vizzy voice.
 * Always uses America/Toronto regardless of workspace settings.
 * Includes seconds for precision.
 */
export function getTorontoTimePayload(date: Date = new Date()): {
  timeString: string;
  timeOfDay: TimeOfDay;
  dateString: string;
} {
  const tz = "America/Toronto";
  const parts = getZonedDateTimeParts(date, tz);
  const timeOfDay = getTimeOfDayInTimezone(tz, date);

  const timeString = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);

  const dateString = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);

  return { timeString, timeOfDay, dateString };
}
