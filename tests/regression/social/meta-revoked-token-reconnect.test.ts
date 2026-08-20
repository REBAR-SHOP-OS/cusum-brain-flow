// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

describe("Meta revoked token handling", () => {
  const resolver = readFileSync("supabase/functions/_shared/metaTokenResolver.ts", "utf8");
  const manualPublish = readFileSync("supabase/functions/social-publish/index.ts", "utf8");
  const cronPublish = readFileSync("supabase/functions/social-cron-publish/index.ts", "utf8");
  const hook = readFileSync("src/hooks/usePublishPost.ts", "utf8");

  it("marks Meta code 190 / invalidated sessions as expired before publishing fan-out", () => {
    expect(resolver).toContain("inspectMetaTokenRemote");
    expect(resolver).toContain("error?.code === 190");
    expect(resolver).toContain("markMetaTokenRejected");
    expect(resolver).toContain("expires_at: now");
    expect(resolver).toContain("reconnect_required: true");
  });

  it("manual and scheduled publishers use remote-validated Meta tokens", () => {
    expect(manualPublish).toContain("resolveValidMetaToken");
    expect(cronPublish).toContain("resolveValidMetaToken");
    expect(manualPublish).not.toContain("resolveMetaToken(\n          supabaseAdmin");
    expect(cronPublish).not.toContain("resolveMetaToken(supabase");
  });

  it("manual publish returns a reconnect result instead of throwing a 400 for revoked tokens", () => {
    expect(manualPublish).toContain("reconnect_required: true");
    expect(manualPublish).toMatch(/JSON\.stringify\(\{ error: errMsg, reconnect_required: true \}\)[\s\S]{0,160}headers:/);
  });

  it("client handles reconnect_required without throwing an Edge Function runtime error", () => {
    expect(hook).toContain("reconnectRequired");
    expect(hook).toContain("Reconnect Facebook / Instagram");
    const reconnectIdx = hook.indexOf("if (reconnectRequired)");
    const throwIdx = hook.indexOf("throw new Error(data?.error", reconnectIdx);
    expect(reconnectIdx).toBeGreaterThan(0);
    expect(throwIdx).toBeGreaterThan(reconnectIdx);
  });
});