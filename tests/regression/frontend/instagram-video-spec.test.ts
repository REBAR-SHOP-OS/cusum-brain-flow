// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("social publish: Instagram video spec guard", () => {
  const serverSource = readFileSync("supabase/functions/_shared/instagramPublish.ts", "utf8");

  it("blocks WebM/unsupported videos before Instagram processing on the server", () => {
    expect(serverSource).toContain("INSTAGRAM_VIDEO_SPEC_ERROR");
    expect(serverSource).toContain("isClearlyUnsupportedInstagramVideo");
    expect(serverSource).toContain("lowerType.includes(\"webm\")");
  });

  const clientHook = readFileSync("src/hooks/usePublishPost.ts", "utf8");
  it("warns the user client-side before sending a WebM to Instagram", () => {
    expect(clientHook).toMatch(/Video not Instagram-ready/);
    expect(clientHook).toMatch(/webm/i);
    expect(clientHook).toMatch(/post\.platform === "instagram"/);
  });

  const storage = readFileSync("src/lib/socialMediaStorage.ts", "utf8");
  it("preserves the real video extension on upload (no fake .mp4 for WebM)", () => {
    expect(storage).toContain("extensionForBlob");
    expect(storage).toMatch(/mime\.includes\("webm"\)/);
  });
});
