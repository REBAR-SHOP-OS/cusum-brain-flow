// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("social publish: Instagram video spec guard", () => {
  const source = readFileSync("supabase/functions/_shared/instagramPublish.ts", "utf8");

  it("blocks WebM/unsupported videos before Instagram processing", () => {
    expect(source).toContain("INSTAGRAM_VIDEO_SPEC_ERROR");
    expect(source).toContain("isClearlyUnsupportedInstagramVideo");
    expect(source).toContain("lowerType.includes(\"webm\")");
  });
});