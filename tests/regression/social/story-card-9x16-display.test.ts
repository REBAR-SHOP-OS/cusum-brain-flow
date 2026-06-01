// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const calendarSrc = readFileSync(
  resolve(__dirname, "../../../src/components/social/SocialCalendar.tsx"),
  "utf8",
);

describe("Story posts render as 9:16 cards in the weekly calendar", () => {
  it("gates the 9:16 thumbnail behind content_type === 'story'", () => {
    expect(calendarSrc).toMatch(/post\.content_type === "story"/);
    expect(calendarSrc).toMatch(/aspect-\[9\/16\]/);
  });

  it("renders the image (or video poster) inside the 9:16 frame when available", () => {
    // The story thumbnail block must include both an <img> and a <video> branch
    // so that AI-generated stills and uploaded clips both honour 9:16.
    const block = calendarSrc.match(/post\.content_type === "story"[\s\S]{0,800}/);
    expect(block).not.toBeNull();
    expect(block![0]).toMatch(/<img\s+src=\{post\.image_url\}/);
    expect(block![0]).toMatch(/<video\s+src=\{post\.image_url\}\s+muted/);
  });

  it("does not apply the 9:16 frame to non-story cards (regression guard)", () => {
    // The only aspect-[9/16] usage in this file must live inside the
    // content_type === "story" branch — no unconditional wrapper.
    const matches = calendarSrc.match(/aspect-\[9\/16\]/g) || [];
    expect(matches.length).toBe(1);
    const idxRatio = calendarSrc.indexOf("aspect-[9/16]");
    const idxGate = calendarSrc.indexOf('post.content_type === "story"');
    expect(idxGate).toBeGreaterThan(-1);
    expect(idxRatio).toBeGreaterThan(idxGate);
  });
});
