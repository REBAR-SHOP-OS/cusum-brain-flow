import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("app shell cache update policy", () => {
  const main = fs.readFileSync(path.join(root, "src/main.tsx"), "utf8");
  const viteConfig = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");

  it("registers the PWA service worker with immediate update handling", () => {
    expect(main).toMatch(/registerSW/);
    expect(main).toMatch(/immediate:\s*true/);
    expect(main).toMatch(/onNeedRefresh/);
    expect(main).toMatch(/updateServiceWorker\(true\)/);
    expect(main).toMatch(/registration\.update\(\)/);
  });

  it("cleans old workbox caches and activates the new worker promptly", () => {
    expect(viteConfig).toMatch(/cleanupOutdatedCaches:\s*true/);
    expect(viteConfig).toMatch(/clientsClaim:\s*true/);
    expect(viteConfig).toMatch(/skipWaiting:\s*true/);
  });

  it("does not keep Supabase API responses for a full day", () => {
    expect(viteConfig).not.toMatch(/maxAgeSeconds:\s*60\s*\*\s*60\s*\*\s*24/);
    expect(viteConfig).toMatch(/maxAgeSeconds:\s*60/);
    expect(viteConfig).toMatch(/networkTimeoutSeconds:\s*5/);
  });
});
