// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("MediaRecorder prefers Instagram-ready MP4", () => {
  const helper = readFileSync("src/lib/recorderMime.ts", "utf8");

  it("lists MP4/H.264 candidates before WebM", () => {
    const mp4Idx = helper.indexOf('"video/mp4');
    const webmIdx = helper.indexOf('"video/webm');
    expect(mp4Idx).toBeGreaterThan(0);
    expect(webmIdx).toBeGreaterThan(mp4Idx);
  });

  it("includes H.264 + AAC for tracks with audio", () => {
    expect(helper).toContain("avc1.42E01E,mp4a.40.2");
  });

  const slideshow = readFileSync("src/lib/slideshowToVideo.ts", "utf8");
  it("slideshowToVideo uses pickRecorderMime, not a hardcoded WebM string", () => {
    expect(slideshow).toContain("pickRecorderMime({ hasAudio: false })");
    expect(slideshow).not.toMatch(/"video\/webm;codecs=vp9"/);
  });

  const merge = readFileSync("src/lib/videoAudioMerge.ts", "utf8");
  it("mergeVideoAudio uses pickRecorderMime, not a hardcoded WebM string", () => {
    expect(merge).toContain("pickRecorderMime({ hasAudio: true })");
    expect(merge).not.toMatch(/"video\/webm;codecs=vp9,opus"/);
  });
});
