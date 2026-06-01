import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Regenerate Story button (9:16)", () => {
  const panel = readFileSync(
    resolve(__dirname, "../../../src/components/social/PostReviewPanel.tsx"),
    "utf-8"
  );
  const edge = readFileSync(
    resolve(__dirname, "../../../supabase/functions/regenerate-post/index.ts"),
    "utf-8"
  );

  it("renders 'Regenerate Story' button gated by isStory", () => {
    expect(panel).toContain("Regenerate Story");
    expect(panel).toMatch(/isStory\s*&&[\s\S]*Regenerate Story/);
  });

  it("invokes regenerate-post with image_only:true", () => {
    expect(panel).toMatch(/invokeEdgeFunction\(\s*"regenerate-post"\s*,\s*\{\s*post_id:\s*post\.id,\s*image_only:\s*true/);
  });

  it("edge function image_only branch still locks 9:16", () => {
    expect(edge).toContain('imageAspectRatio: "9:16"');
    expect(edge).toContain("OUTPUT CANVAS MUST BE 9:16 STORY PORTRAIT");
  });
});
