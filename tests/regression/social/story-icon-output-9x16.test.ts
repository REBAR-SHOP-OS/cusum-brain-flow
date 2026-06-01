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
    expect(managerSrc).toMatch(/generatePosts\(\{[\s\S]{0,200}mode:\s*"story"/);
  });

  it("auto-generate-post enforces strict 9:16 server-side for story", () => {
    expect(autoGenSrc).toMatch(/cropToAspectRatioStrict\(bytes,\s*"9:16"\)/);
    expect(autoGenSrc).toMatch(/size:\s*"1024x1792"/);
  });

  it("auto-generate-post hard-validates encoded Story bytes are exactly 1080x1920", () => {
    // Decoded PNG dimensions must be asserted after the strict crop, so a model
    // that lies about its canvas can never persist as a Story image.
    expect(autoGenSrc).toMatch(/assertStoryDimensions\(bytes\)/);
    expect(autoGenSrc).toMatch(/img\.width !== 1080 \|\| img\.height !== 1920/);
  });

  it("auto-generate-post never saves a Story card with a null image", () => {
    // If generation fails, the placeholder is deleted — NOT overwritten with null.
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
