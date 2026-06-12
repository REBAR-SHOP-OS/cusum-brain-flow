// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Instagram durable JPEG media (root-cause fix for Meta code 2)", () => {
  it("instagramPublish.ts materializes non-video images as durable JPEG storage objects", () => {
    const src = readFileSync(
      "supabase/functions/_shared/instagramPublish.ts",
      "utf8",
    );
    expect(src).toContain("materializeInstagramImageUrl");
    expect(src).toContain("IG_READY_PREFIX");
    expect(src).toContain("encodeJPEG");
    expect(src).toContain("contentType: \"image/jpeg\"");
    // Materializing must only happen for non-video media (videos use video_url path).
    expect(src).toMatch(/if \(!isVideo\)[\s\S]{0,140}materializeInstagramImageUrl/);
    expect(src).not.toContain("/functions/v1/ig-media-proxy?src=");
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
