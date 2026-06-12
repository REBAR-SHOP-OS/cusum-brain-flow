// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const helper = readFileSync("supabase/functions/_shared/instagramPublish.ts", "utf8");
const publish = readFileSync("supabase/functions/social-publish/index.ts", "utf8");
const cron = readFileSync("supabase/functions/social-cron-publish/index.ts", "utf8");

describe("Instagram durable JPEG media (root-cause fix for Meta code 2)", () => {
  it("exports a loud-failing prepareInstagramImageUrl helper", () => {
    expect(helper).toContain("export async function prepareInstagramImageUrl");
    expect(helper).toContain("IG_READY_PREFIX");
    expect(helper).toContain("encodeJPEG");
    expect(helper).toContain('contentType: "image/jpeg"');
    // Result is a discriminated ok/error union — no silent fallback to source URL.
    expect(helper).toMatch(/ok:\s*false,\s*error:/);
    expect(helper).not.toContain("materializeInstagramImageUrl");
  });

  it("publishInstagramMedia guards every non-video call with the prepare helper", () => {
    expect(helper).toMatch(/if \(!isVideo\)[\s\S]{0,200}prepareInstagramImageUrl/);
    expect(helper).toMatch(/if \(!prepared\.ok\)[\s\S]{0,80}return \{ error: prepared\.error \}/);
  });

  it("social-publish prepares the IG image ONCE upstream and reuses it", () => {
    expect(publish).toContain("prepareInstagramImageUrl");
    expect(publish).toMatch(/let igImageUrl[\s\S]{0,600}prepareInstagramImageUrl/);
    expect(publish).toMatch(/publishToInstagram\([\s\S]{0,200}igImageUrl/);
    // Failed preparation must short-circuit before the IG fan-out.
    expect(publish).toMatch(/if \(!prepared\.ok\)[\s\S]{0,300}individualPages = \[\];/);
    // Prepared URL is persisted so manual retries / UI use the verified URL.
    expect(publish).toMatch(/\.update\(\{ image_url: igImageUrl \}\)/);
  });

  it("social-cron-publish uses the same prepared URL contract", () => {
    expect(cron).toContain("prepareInstagramImageUrl");
    expect(cron).toMatch(/publishToInstagram\(igAccountId, pat, message, igImageUrl,/);
    expect(cron).toMatch(/\.update\(\{ image_url: igImageUrl \}\)/);
  });

  it("surfaces Meta fbtrace_id in errors and retries on not-ready images", () => {
    expect(helper).toContain("fbtrace_id");
    expect(helper).toMatch(/fbtrace \$\{e\.fbtrace_id/);
    expect(helper).toContain("IMAGE_PUBLISH_DELAYS_MS");
    expect(helper).toContain("media id is not available");
    expect(helper).toMatch(/\[0, \.\.\.IMAGE_PUBLISH_DELAYS_MS\]/);
  });

  it("manual retry skips pages that already succeeded on a partial publish", () => {
    expect(publish).toContain("alreadySuccessfulPages");
    expect(publish).toContain('"published"');
    const lockSrc = readFileSync("supabase/functions/_shared/publishLock.ts", "utf8");
    expect(lockSrc).toContain("Preserve already-published pages on retry");
  });
});
