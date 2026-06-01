// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const managerSrc = readFileSync(
  resolve(__dirname, "../../../src/pages/SocialMediaManager.tsx"),
  "utf8",
);
const autoGenSrc = readFileSync(
  resolve(__dirname, "../../../supabase/functions/auto-generate-post/index.ts"),
  "utf8",
);
const pixelCardSrc = readFileSync(
  resolve(__dirname, "../../../src/components/social/PixelPostCard.tsx"),
  "utf8",
);
const reviewPanelSrc = readFileSync(
  resolve(__dirname, "../../../src/components/social/PostReviewPanel.tsx"),
  "utf8",
);

describe("Story icon → 9:16 image generation + 9:16 card display", () => {
  it("Story popover icon still triggers mode=story generation", () => {
    expect(managerSrc).toMatch(/generatePosts\(\{[\s\S]{0,400}mode:\s*"story"/);
  });

  it("auto-generate-post enforces strict 9:16 server-side for story", () => {
    expect(autoGenSrc).toMatch(/cropToAspectRatioStrict\(bytes,\s*"9:16"\)/);
    expect(autoGenSrc).toMatch(/size:\s*isStoryRatio\s*\?\s*"1024x1792"/);
  });

  it("auto-generate-post hard-validates encoded Story bytes are exactly 1080x1920", () => {
    expect(autoGenSrc).toMatch(/assertStoryDimensions\(bytes\)/);
    expect(autoGenSrc).toMatch(/img\.width !== 1080 \|\| img\.height !== 1920/);
  });

  it("auto-generate-post never saves a Story card with a null image", () => {
    expect(autoGenSrc).toMatch(/if \(!imageUrl\)[\s\S]{0,200}social_posts[\s\S]{0,80}\.delete\(\)/);
  });

  it("PixelPostCard renders Story posts as aspect-[9/16], others as aspect-square", () => {
    expect(pixelCardSrc).toMatch(/content_type\?:\s*string/);
    expect(pixelCardSrc).toMatch(/isStory\s*=\s*post\.content_type\s*===\s*"story"/);
    expect(pixelCardSrc).toMatch(/isStory \?[\s\S]{0,80}aspect-\[9\/16\][\s\S]{0,80}:\s*"w-full aspect-square"/);
  });

  it("PostReviewPanel still wraps Story image preview in aspect-[9/16]", () => {
    expect(reviewPanelSrc).toMatch(/isStory[\s\S]{0,80}aspect-\[9\/16\]/);
  });
});

describe("Story popover → user picks aspect ratio for generated image", () => {
  const hookSrc = readFileSync(
    resolve(__dirname, "../../../src/hooks/useAutoGenerate.ts"),
    "utf8",
  );

  it("popover exposes all 4 aspect ratio options", () => {
    expect(managerSrc).toMatch(/Step 2 · Pick image size/);
    for (const ratio of ['"9:16"', '"1:1"', '"4:5"', '"16:9"']) {
      expect(managerSrc).toContain(ratio);
    }
  });

  it("generatePosts forwards aspectRatio to the edge function body", () => {
    expect(hookSrc).toMatch(/aspectRatio\?:\s*"9:16"\s*\|\s*"1:1"\s*\|\s*"4:5"\s*\|\s*"16:9"/);
    expect(hookSrc).toMatch(/body:\s*\{[\s\S]{0,400}aspectRatio,/);
  });

  it("non-9:16 ratios are saved as regular posts (content_type null), not Story", () => {
    expect(hookSrc).toMatch(/isStoryRatio\s*=\s*isStory\s*&&\s*aspectRatio\s*===\s*"9:16"/);
    expect(hookSrc).toMatch(/content_type:\s*isStoryRatio\s*\?\s*"story"\s*:\s*null/);
    expect(autoGenSrc).toMatch(/content_type:\s*isStoryRatio\s*\?\s*"story"\s*:\s*null/);
  });

  it("edge function maps aspect ratio to gpt-image size + strict crop + dimension assertion", () => {
    expect(autoGenSrc).toMatch(/ASPECT_SIZE/);
    expect(autoGenSrc).toMatch(/"1:1":\s*\{\s*gpt:\s*"1024x1024",\s*w:\s*1536,\s*h:\s*1536\s*\}/);
    expect(autoGenSrc).toMatch(/"4:5":\s*\{\s*gpt:\s*"1024x1280",\s*w:\s*1228,\s*h:\s*1536\s*\}/);
    expect(autoGenSrc).toMatch(/"16:9":\s*\{\s*gpt:\s*"1792x1024",\s*w:\s*1920,\s*h:\s*1080\s*\}/);
    expect(autoGenSrc).toMatch(/cropToAspectRatioStrict\(bytes,\s*storyAspect\)/);
    expect(autoGenSrc).toMatch(/assertImageDimensions\(bytes,\s*aspectCfg\.w,\s*aspectCfg\.h\)/);
  });
});
