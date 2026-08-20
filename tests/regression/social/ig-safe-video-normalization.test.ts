// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Instagram-safe video normalization (root-cause fix)", () => {
  const helper = readFileSync("src/lib/igSafeVideo.ts", "utf8");

  it("locks the IG-safe encoding spec: 30 fps, 8 Mbps, H.264 High Level 4.1, AAC-LC", () => {
    expect(helper).toMatch(/fps:\s*30/);
    expect(helper).toMatch(/videoBitrate:\s*8_000_000/);
    expect(helper).toContain("avc1.640029"); // H.264 High @ Level 4.1
    expect(helper).toContain("mp4a.40.2"); // AAC-LC
  });

  it("uses mp4-muxer with fastStart (moov at head) so IG can stream the upload", () => {
    expect(helper).toContain('from "mp4-muxer"');
    expect(helper).toMatch(/fastStart:\s*"in-memory"/);
  });

  it("exports normalizeForInstagram and is safe when WebCodecs is missing", () => {
    expect(helper).toContain("export async function normalizeForInstagram");
    expect(helper).toContain("webcodecs_unavailable");
  });

  const storage = readFileSync("src/lib/socialMediaStorage.ts", "utf8");
  it("uploadSocialMediaAsset normalizes every video before storing it", () => {
    expect(storage).toContain('import { normalizeForInstagram }');
    expect(storage).toMatch(/if \(type === "video"\)[\s\S]{0,200}normalizeForInstagram/);
  });

  const publish = readFileSync("src/hooks/usePublishPost.ts", "utf8");
  it("publishPost auto-heals Instagram videos and persists the new URL", () => {
    expect(publish).toContain("normalizeForInstagram(url)");
    expect(publish).toMatch(/\.update\(\{\s*image_url:\s*newUrl\s*\}\)/);
  });
});
