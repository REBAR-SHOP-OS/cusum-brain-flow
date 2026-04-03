import { describe, expect, it } from "vitest";
import { buildInstructions } from "../useVizzyVoiceEngine";
import { resolveVizzyTimeContext } from "@/lib/vizzyTimeContext";

describe("resolveVizzyTimeContext", () => {
  it("uses the provided timezone instead of the browser timezone", () => {
    const resolved = resolveVizzyTimeContext({
      generatedAt: "2026-04-03T16:30:00.000Z",
      timezone: "America/Toronto",
    });

    expect(resolved).toEqual({
      nowStr: "Apr 3, 2026, 12:30 PM",
      timeOfDay: "afternoon",
      timezone: "America/Toronto",
    });
  });
});

describe("buildInstructions", () => {
  it("injects workspace time metadata into Vizzy's prompt", () => {
    const instructions = buildInstructions("DIGEST CONTENT", null, {
      generatedAt: "2026-04-03T23:30:00.000Z",
      timezone: "America/Toronto",
    });

    expect(instructions).toContain(
      'CURRENT TIME CONTEXT: It is currently evening (Apr 3, 2026, 7:30 PM America/Toronto). Greet the CEO with "Good evening!" or a natural variation.'
    );
    expect(instructions).toContain(
      "═══ YOUR PRE-SESSION STUDY NOTES (you already analyzed everything — as of Apr 3, 2026, 7:30 PM America/Toronto) ═══"
    );
    expect(instructions).toContain("DIGEST CONTENT");
  });

  it("falls back to live data wording when only raw context is available", () => {
    const instructions = buildInstructions(null, "RAW ERP CONTEXT", {
      generatedAt: "2026-04-03T14:15:00.000Z",
      timezone: "America/Los_Angeles",
    });

    expect(instructions).toContain(
      'CURRENT TIME CONTEXT: It is currently morning (Apr 3, 2026, 7:15 AM America/Los_Angeles). Greet the CEO with "Good morning!" or a natural variation.'
    );
    expect(instructions).toContain(
      "═══ LIVE BUSINESS DATA (as of Apr 3, 2026, 7:15 AM America/Los_Angeles) ═══"
    );
    expect(instructions).toContain("RAW ERP CONTEXT");
  });
});
