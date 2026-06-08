// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Instagram codec probe", () => {
  const probeSrc = readFileSync("supabase/functions/_shared/videoProbe.ts", "utf8");

  it("only treats avc1/avc3 + mp4a as Instagram-ready", () => {
    expect(probeSrc).toContain('VIDEO_CODECS_INSTAGRAM_OK = new Set(["avc1", "avc3"])');
    expect(probeSrc).toContain('AUDIO_CODECS_INSTAGRAM_OK = new Set(["mp4a"])');
  });

  it("falls back to tail Range when moov is not at the head", () => {
    expect(probeSrc).toMatch(/bytes=-1048576/);
  });

  it("is conservative on probe failure (not ready)", () => {
    expect(probeSrc).toMatch(/probe_failed_fetch[\s\S]*isInstagramReady: false/);
    expect(probeSrc).toMatch(/moov_not_found[\s\S]*isInstagramReady: false/);
  });

  const publishSrc = readFileSync("supabase/functions/_shared/instagramPublish.ts", "utf8");
  it("runs the codec probe before creating the IG container", () => {
    expect(publishSrc).toContain('import { probeVideoForInstagram, describeProbeFailure } from "./videoProbe.ts"');
    // probe must run before media container POST
    const probeIdx = publishSrc.indexOf("probeVideoForInstagram(imageUrl)");
    const containerIdx = publishSrc.indexOf(`${"/media"}\``); // template literal `${igAccountId}/media`
    expect(probeIdx).toBeGreaterThan(0);
    expect(containerIdx).toBeGreaterThan(probeIdx);
  });

  it("returns the spec error + human reason when probe says not ready", () => {
    expect(publishSrc).toMatch(/probe\.isInstagramReady[\s\S]*describeProbeFailure\(probe\)/);
  });
});
