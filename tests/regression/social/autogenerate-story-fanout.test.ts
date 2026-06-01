// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Auto-generate Story (9:16) fans out per-placeholder regenerate-post calls", () => {
  const hook = readFileSync(
    resolve(__dirname, "../../../src/hooks/useAutoGenerate.ts"),
    "utf-8"
  );
  const edge = readFileSync(
    resolve(__dirname, "../../../supabase/functions/regenerate-post/index.ts"),
    "utf-8"
  );

  it("uses Promise.allSettled to dispatch one regenerate-post per placeholder", () => {
    expect(hook).toMatch(/isStoryRatio && placeholderIds\.length > 0/);
    expect(hook).toMatch(/Promise\.allSettled\(\s*placeholderIds\.map/);
    expect(hook).toMatch(/supabase\.functions\.invoke\("regenerate-post"/);
  });

  it("each parallel call carries story_mode:true and image_only:true", () => {
    expect(hook).toMatch(/post_id:\s*phId/);
    expect(hook).toMatch(/image_only:\s*true/);
    expect(hook).toMatch(/story_mode:\s*true/);
    expect(hook).toMatch(/variation_hint:/);
  });

  it("does NOT call auto-generate-post on the story+9:16 path", () => {
    // The story branch returns before reaching the auto-generate-post invoke.
    const storyBlock = hook.slice(
      hook.indexOf("isStoryRatio && placeholderIds.length > 0"),
      hook.indexOf("// Phase 1: Call edge function with placeholder IDs")
    );
    expect(storyBlock.length).toBeGreaterThan(0);
    expect(storyBlock).not.toMatch(/auto-generate-post/);
  });

  it("deletes the placeholder when a slot fails (uses .select('id'))", () => {
    expect(hook).toMatch(/\.delete\(\)\.eq\("id",\s*phId\)\.select\("id"\)/);
  });

  it("regenerate-post accepts product + variation_hint and still hard-locks 9:16/1080x1920", () => {
    expect(edge).toMatch(/variation_hint,\s*product:\s*productOverride/);
    expect(edge).toMatch(/cropToAspectRatioStrict\(bytes,\s*"9:16"\)/);
    expect(edge).toMatch(/assertStoryDimensions\(bytes\)/);
    expect(edge).toMatch(/size:\s*"1024x1792"/);
  });
});
