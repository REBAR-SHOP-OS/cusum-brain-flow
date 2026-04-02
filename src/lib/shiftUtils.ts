/** Shift boundary utilities for shop floor filtering */
import { toZonedNow, DEFAULT_TIMEZONE } from "@/lib/dateConfig";

export type ShiftType = "day" | "night" | "all";

/** Day shift: 6:00 AM – 6:00 PM business timezone */
export const DAY_SHIFT_START_HOUR = 6;
export const DAY_SHIFT_END_HOUR = 18;

/** Returns the current shift based on business timezone */
export function getCurrentShift(tz: string = DEFAULT_TIMEZONE): "day" | "night" {
  const hour = toZonedNow(tz).getHours();
  return hour >= DAY_SHIFT_START_HOUR && hour < DAY_SHIFT_END_HOUR ? "day" : "night";
}

/** Returns [start, end] ISO timestamps for the requested shift on today's date */
export function getShiftWindow(shift: "day" | "night"): [string, string] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (shift === "day") {
    const start = new Date(today);
    start.setHours(DAY_SHIFT_START_HOUR, 0, 0, 0);
    const end = new Date(today);
    end.setHours(DAY_SHIFT_END_HOUR, 0, 0, 0);
    return [start.toISOString(), end.toISOString()];
  }

  // Night shift spans two calendar days
  const hour = now.getHours();
  if (hour >= DAY_SHIFT_END_HOUR) {
    // Evening portion: 6PM today → 6AM tomorrow
    const start = new Date(today);
    start.setHours(DAY_SHIFT_END_HOUR, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    end.setHours(DAY_SHIFT_START_HOUR, 0, 0, 0);
    return [start.toISOString(), end.toISOString()];
  } else {
    // Morning portion: 6PM yesterday → 6AM today
    const start = new Date(today);
    start.setDate(start.getDate() - 1);
    start.setHours(DAY_SHIFT_END_HOUR, 0, 0, 0);
    const end = new Date(today);
    end.setHours(DAY_SHIFT_START_HOUR, 0, 0, 0);
    return [start.toISOString(), end.toISOString()];
  }
}

/** Label for display */
export function getShiftLabel(shift: ShiftType): string {
  if (shift === "all") return "All Shifts";
  if (shift === "day") return "Day (6AM–6PM)";
  return "Night (6PM–6AM)";
}
