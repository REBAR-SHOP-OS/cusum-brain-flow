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
    const sizeLine = generateImageSrc.match(/size:\s*aspectRatio === "9:16" \? "1024x1536" : "1024x1024"/);
    expect(sizeLine).not.toBeNull();

    const openAiFallback = generateImageSrc.slice(generateImageSrc.indexOf("// ── Fallback: OpenAI models ──"));
    expect(openAiFallback).toMatch(/MANDATORY OUTPUT FORMAT: 9:16 vertical portrait/);
    expect(openAiFallback).not.toMatch(/aspectRatio === "9:16"[\s\S]{0,120}size:\s*"1024x1024"/);
  });
});