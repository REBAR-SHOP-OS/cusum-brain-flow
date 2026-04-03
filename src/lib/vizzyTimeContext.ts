export interface VizzyInstructionTimeContext {
  generatedAt: string;
  timezone: string;
}

export interface VizzyResolvedTimeContext {
  nowStr: string;
  timeOfDay: "morning" | "afternoon" | "evening";
  timezone: string;
}

function getHourInTimezone(date: Date, timezone: string): number | null {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  })
    .formatToParts(date)
    .find((part) => part.type === "hour");

  if (!hourPart) return null;

  const hour = Number(hourPart.value);
  return Number.isNaN(hour) ? null : hour;
}

export function resolveVizzyTimeContext(
  context: VizzyInstructionTimeContext | null | undefined
): VizzyResolvedTimeContext | null {
  if (!context?.generatedAt || !context?.timezone) return null;

  const date = new Date(context.generatedAt);
  if (Number.isNaN(date.getTime())) return null;

  const hour = getHourInTimezone(date, context.timezone);
  if (hour == null) return null;

  const timeOfDay =
    hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const nowStr = new Intl.DateTimeFormat("en-US", {
    timeZone: context.timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return {
    nowStr,
    timeOfDay,
    timezone: context.timezone,
  };
}
