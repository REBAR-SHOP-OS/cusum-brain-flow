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


/** Label for display */
export function getShiftLabel(shift: ShiftType): string {
  if (shift === "all") return "All Shifts";
  if (shift === "day") return "Day (6AM–6PM)";
  return "Night (6PM–6AM)";
}
