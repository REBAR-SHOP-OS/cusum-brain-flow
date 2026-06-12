// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression: `content_type === "story"` must NOT force the Instagram video
 * pipeline. Stories can be image OR video; only actual video signals (URL
 * extension or `video/*` HEAD content-type) should trigger
 * `normalizeForInstagram` and the "Preparing video for Instagram…" toast.
 *
 * Bug: previously, every story (including PNG/JPG stories) showed the
 * "Re-encoding to Reels-safe spec" toast and ran the video normalizer.
 */
describe("usePublishPost — image story must skip video pipeline", () => {
  const src = readFileSync(
    join(process.cwd(), "src/hooks/usePublishPost.ts"),
    "utf8",
  );

  it("does not include content_type === 'story' in the video gate", () => {
    // The old gate had `post.content_type === "story"` as an OR-branch.
    // Forbid that exact substring in the looksLikeVideo decision.
    const gateMatch = src.match(/const looksLikeVideo[\s\S]{0,400}?;/);
    expect(gateMatch, "looksLikeVideo block not found").toBeTruthy();
    expect(gateMatch![0]).not.toContain('content_type === "story"');
  });

  it("still treats reels as video", () => {
    expect(src).toContain('content_type === "reel"');
  });

  it("uses URL extension and HEAD content-type to detect video", () => {
    expect(src).toMatch(/urlIsVideo\s*=\s*\/\\\.\(mp4\|m4v\|mov\|webm\|mkv\)/);
    expect(src).toContain('headIsVideo');
    expect(src).toContain('startsWith("video/")');
  });

  it("only swaps image_url when normalized blob is actually a video", () => {
    // Guard prevents image stories from being overwritten with a video blob.
    expect(src).toContain('normMime.startsWith("video/")');
  });

  it("toast 'Preparing video for Instagram…' only inside video branch", () => {
    const toastIdx = src.indexOf("Preparing video for Instagram");
    const gateIdx = src.indexOf("if (looksLikeVideo)");
    expect(gateIdx).toBeGreaterThan(0);
    expect(toastIdx).toBeGreaterThan(gateIdx);
  });
});
