// @vitest-environment node
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

  it("invokes regenerate-post with image_only:true AND story_mode:true", () => {
    expect(panel).toMatch(
      /invokeEdgeFunction\(\s*"regenerate-post"\s*,\s*\{\s*post_id:\s*post\.id,\s*image_only:\s*true,\s*story_mode:\s*true/
    );
  });

  it("edge function image_only branch has a dedicated story_mode path", () => {
    expect(edge).toMatch(/const isStoryPost = story_mode === true \|\| post\.content_type === "story"/);
    expect(edge).toMatch(/if \(isStoryPost\) \{/);
  });

  it("story path uses gpt-image-2 at 1024x1792 and asserts 1080x1920 output", () => {
    // Locate story block boundaries
    const startIdx = edge.indexOf("if (isStoryPost) {");
    expect(startIdx).toBeGreaterThan(-1);
    const storyBlock = edge.slice(startIdx, startIdx + 5000);
    expect(storyBlock).toMatch(/model:\s*"openai\/gpt-image-2"/);
    expect(storyBlock).toMatch(/size:\s*"1024x1792"/);
    expect(storyBlock).toMatch(/cropToAspectRatioStrict\(bytes,\s*"9:16"\)/);
    expect(storyBlock).toMatch(/assertStoryDimensions\(bytes\)/);
    // No previousImageUrl is passed into the story generator
    expect(storyBlock).not.toMatch(/previousImageUrl/);
    // Must NOT route into the unstable Gemini-first generatePixelImage path
    expect(storyBlock).not.toMatch(/generatePixelImage\(/);
  });

  it("assertStoryDimensions hard-validates 1080x1920", () => {
    expect(edge).toMatch(/img\.width !== 1080 \|\| img\.height !== 1920/);
  });
});
