// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const generateImageSrc = readFileSync(
  resolve(__dirname, "../../../supabase/functions/generate-image/index.ts"),
  "utf8",
);

const imageDialogSrc = readFileSync(
  resolve(__dirname, "../../../src/components/social/ImageGeneratorDialog.tsx"),
  "utf8",
);

const autoGenerateSrc = readFileSync(
  resolve(__dirname, "../../../supabase/functions/auto-generate-post/index.ts"),
  "utf8",
);

const regenerateSrc = readFileSync(
  resolve(__dirname, "../../../supabase/functions/regenerate-post/index.ts"),
  "utf8",
);

const imageResizeSrc = readFileSync(
  resolve(__dirname, "../../../supabase/functions/_shared/imageResize.ts"),
  "utf8",
);

const postReviewPanelSrc = readFileSync(
  resolve(__dirname, "../../../src/components/social/PostReviewPanel.tsx"),
  "utf8",
);

describe("Social story images are strictly 9:16", () => {
  it("uses strict server-side 9:16 enforcement in all social image generation paths", () => {
    expect(generateImageSrc).toMatch(/cropToAspectRatioStrict\(imageBytes, aspectRatio\)/);
    expect(generateImageSrc).toMatch(/cropToAspectRatioStrict\(await imageUrlToBytes\(imageUrl\), "9:16"\)/);
    expect(autoGenerateSrc).toMatch(/cropToAspectRatioStrict\(bytes, "9:16"\)/);
    expect(regenerateSrc).toMatch(/cropToAspectRatioStrict\(imageBytes, aspectRatio\)/);
  });

  it("does not let the Story dialog silently accept failed portrait enforcement", () => {
    expect(imageDialogSrc).toMatch(/aspectRatio:\s*storyMode \? "9:16" : "1:1"/);
    expect(imageDialogSrc).toMatch(/if \(storyMode\) \{[\s\S]*setStatus\("failed"\);[\s\S]*return;/);
  });

  it("never sends square output size for the 9:16 OpenAI fallback path", () => {
    const sizeLine = generateImageSrc.match(/size:\s*aspectRatio === "9:16" \? "1024x1792" : "1024x1024"/);
    expect(sizeLine).not.toBeNull();

    const openAiFallback = generateImageSrc.slice(generateImageSrc.indexOf("// ── Fallback: OpenAI models ──"));
    expect(openAiFallback).toMatch(/OUTPUT CANVAS MUST BE 9:16 STORY PORTRAIT/);
    expect(openAiFallback).not.toMatch(/aspectRatio === "9:16"[\s\S]{0,120}size:\s*"1024x1024"/);
  });

  it("stores strict story crops as true 1080x1920 and displays stories as portrait", () => {
    expect(imageResizeSrc).toMatch(/if \(r === "9:16"\) return \{ w: 1080, h: 1920 \}/);
    expect(autoGenerateSrc).toMatch(/size:\s*"1024x1792"/);
    expect(regenerateSrc).toMatch(/"9:16": "1024x1792"/);
    expect(postReviewPanelSrc).toMatch(/isStory[\s\S]*aspect-\[9\/16\]/);
  });

  it("forces LLM to bake advertising text onto every generated banner", () => {
    // Story prompt requires headline + wordmark + CTA
    expect(autoGenerateSrc).toMatch(/BAKED-IN ADVERTISING TEXT \(MANDATORY/);
    expect(autoGenerateSrc).toMatch(/Call 647-260-9403/);
    expect(autoGenerateSrc).toMatch(/COMPANY ADVERTISING BANNER/);

    // Calendar post system prompt requires baked-in ad text
    expect(autoGenerateSrc).toMatch(/BAKED-IN ADVERTISING TEXT IS MANDATORY/);

    // Manual generate-image dialog enforces banner format with text
    expect(generateImageSrc).toMatch(/MANDATORY ADVERTISING BANNER FORMAT/);
    expect(generateImageSrc).toMatch(/BAKED-IN, perfectly legible TEXT/);

    // Regenerate (image-only + full) require baked-in advertising text
    expect(regenerateSrc).toMatch(/COMPANY ADVERTISING BANNER for REBAR\.SHOP/);
    expect(regenerateSrc).toMatch(/BAKED-IN ADVERTISING TEXT \(MANDATORY/);
  });
});