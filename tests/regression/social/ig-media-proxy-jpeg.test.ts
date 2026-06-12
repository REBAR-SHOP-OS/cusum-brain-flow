// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

describe("Instagram media proxy (root-cause fix for Meta code 2)", () => {
  it("ig-media-proxy edge function exists and re-encodes PNG to JPEG", () => {
    const path = "supabase/functions/ig-media-proxy/index.ts";
    expect(existsSync(path)).toBe(true);
    const src = readFileSync(path, "utf8");
    // Restricts to Supabase host so the proxy can't be abused as an open relay.
    expect(src).toContain(".supabase.co");
    // Re-encodes PNG → JPEG via imagescript.
    expect(src).toContain("encodeJPEG");
    // Serves with a clean image/jpeg content-type and aggressive caching.
    expect(src).toContain("image/jpeg");
    expect(src).toMatch(/Cache-Control[\s\S]*max-age/);
  });

  it("instagramPublish.ts routes non-video images through ig-media-proxy", () => {
    const src = readFileSync(
      "supabase/functions/_shared/instagramPublish.ts",
      "utf8",
    );
    expect(src).toContain("wrapWithIgMediaProxy");
    expect(src).toContain("/functions/v1/ig-media-proxy");
    // Wrapping must only happen for non-video media (videos use video_url path).
    expect(src).toMatch(/if \(!isVideo\)[\s\S]{0,120}wrapWithIgMediaProxy/);
  });

  it("surfaces Meta fbtrace_id in the error so failures are diagnosable", () => {
    const src = readFileSync(
      "supabase/functions/_shared/instagramPublish.ts",
      "utf8",
    );
    expect(src).toContain("fbtrace_id");
    expect(src).toMatch(/fbtrace \$\{e\.fbtrace_id/);
  });

  it("retries delayed image publishes when Meta says the media ID is not ready", () => {
    const src = readFileSync(
      "supabase/functions/_shared/instagramPublish.ts",
      "utf8",
    );
    expect(src).toContain("IMAGE_PUBLISH_DELAYS_MS");
    expect(src).toContain("media id is not available");
    expect(src).toMatch(/\[0, \.\.\.IMAGE_PUBLISH_DELAYS_MS\]/);
  });

  it("manual retry skips pages that already succeeded on a partial publish", () => {
    const publishSrc = readFileSync(
      "supabase/functions/social-publish/index.ts",
      "utf8",
    );
    const lockSrc = readFileSync("supabase/functions/_shared/publishLock.ts", "utf8");
    expect(publishSrc).toContain("alreadySuccessfulPages");
    expect(publishSrc).toContain('"published"');
    expect(lockSrc).toContain("Preserve already-published pages on retry");
  });
});
