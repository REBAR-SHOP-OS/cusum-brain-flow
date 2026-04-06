import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getHourInTimezone,
  getStartOfDayIsoInTimezone,
  getTimeContextInTimezone,
} from "@/lib/dateConfig";

describe("dateConfig timezone helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives hour and greeting from the requested timezone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-03T15:30:00.000Z"));

    expect(getHourInTimezone("America/Los_Angeles")).toBe(8);
    expect(getTimeContextInTimezone("America/Los_Angeles")).toMatchObject({
      hour: 8,
      timeOfDay: "morning",
      timezoneLabel: "Los Angeles (PT)",
      timezoneLocation: "Los Angeles",
    });

    expect(getHourInTimezone("America/Toronto")).toBe(11);
    expect(getTimeContextInTimezone("America/Toronto")).toMatchObject({
      hour: 11,
      timeOfDay: "morning",
      timezoneLabel: "Toronto (ET)",
      timezoneLocation: "Toronto",
    });
  });

  it("computes start-of-day ISO boundaries in the requested timezone", () => {
    expect(
      getStartOfDayIsoInTimezone(
        "America/Los_Angeles",
        new Date("2026-04-03T15:30:00.000Z")
      )
    ).toBe("2026-04-03T07:00:00.000Z");

    expect(
      getStartOfDayIsoInTimezone(
        "America/Toronto",
        new Date("2026-04-03T15:30:00.000Z")
      )
    ).toBe("2026-04-03T04:00:00.000Z");
  });
});
