// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const watermarkSrc = readFileSync(
  resolve(__dirname, "../../../src/lib/imageWatermark.ts"),
  "utf8",
);

const dialogSrc = readFileSync(
  resolve(__dirname, "../../../src/components/social/ImageGeneratorDialog.tsx"),
  "utf8",
);

const panelSrc = readFileSync(
  resolve(__dirname, "../../../src/components/social/PostReviewPanel.tsx"),
  "utf8",
);

describe("Story image 9:16 last-mile enforcement", () => {
  it("ensurePortrait resamples into a true 1080x1920 canvas", () => {
    expect(watermarkSrc).toMatch(/STORY_TARGET_W\s*=\s*1080/);
    expect(watermarkSrc).toMatch(/STORY_TARGET_H\s*=\s*1920/);
    // Canvas must be set to the canonical target, not the source crop size.
    expect(watermarkSrc).toMatch(/canvas\.width\s*=\s*STORY_TARGET_W/);
    expect(watermarkSrc).toMatch(/canvas\.height\s*=\s*STORY_TARGET_H/);
    // The early-return shortcut that previously let near-9:16 images bypass
    // resizing must be gone.
    expect(watermarkSrc).not.toMatch(/Math\.abs\(currentRatio - targetRatio\)\s*<\s*0\.01\)\s*return imageUrl/);
  });

  it("logo overlay re-enforces portrait in story mode", () => {
    expect(dialogSrc).toMatch(/if \(storyMode\) \{[\s\S]*finalImageUrl = await ensurePortrait\(finalImageUrl\)/);
  });

  it("PostReviewPanel re-enforces 9:16 before uploading a Story image", () => {
    expect(panelSrc).toMatch(/const postIsStory = \(post\.content_type === "story"\) \|\| localContentType === "story"/);
    expect(panelSrc).toMatch(/sourceUrl = await ensurePortrait\(tempUrl\)/);
    expect(panelSrc).toMatch(/Story image rejected/);
  });

  it("AI Image button inherits Story mode when the active post is a Story", () => {
    // The manual AI Image dialog must run in storyMode whenever the open post
    // is a Story so it can never produce a 1:1 image for a Story slot.
    expect(panelSrc).toMatch(/open=\{showImageGen\}[\s\S]{0,200}storyMode=\{isStory\}/);
  });
});
