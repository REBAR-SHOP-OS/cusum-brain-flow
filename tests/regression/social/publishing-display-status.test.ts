import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { resolveDisplayStatus } from "@/lib/socialPostStatus";

describe("resolveDisplayStatus", () => {
  const NOW = new Date("2026-06-12T16:00:00Z").getTime();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  const ago = (ms: number) => new Date(NOW - ms).toISOString();

  it("flips publishing → failed when every page_result failed", () => {
    const r = resolveDisplayStatus({
      status: "publishing",
      page_results: [
        { name: "A", status: "failed" },
        { name: "B", status: "failed" },
      ],
      updated_at: ago(30 * 1000),
    });
    expect(r.displayStatus).toBe("failed");
    expect(r.partial).toBe(false);
  });

  it("flips publishing → published when every page_result succeeded", () => {
    const r = resolveDisplayStatus({
      status: "publishing",
      page_results: [
        { name: "A", status: "success" },
        { name: "B", status: "success" },
      ],
      updated_at: ago(30 * 1000),
    });
    expect(r.displayStatus).toBe("published");
    expect(r.partial).toBe(false);
  });

  it("flips mixed publishing → published(partial) after the 60s grace window", () => {
    const r = resolveDisplayStatus({
      status: "publishing",
      page_results: [
        { name: "A", status: "success" },
        { name: "B", status: "failed" },
      ],
      updated_at: ago(90 * 1000),
    });
    expect(r.displayStatus).toBe("published");
    expect(r.partial).toBe(true);
  });

  it("flips stale all-pending image post → failed after 3 minutes", () => {
    const r = resolveDisplayStatus({
      status: "publishing",
      page_results: [
        { name: "A", status: "pending" },
        { name: "B", status: "pending" },
      ],
      updated_at: ago(4 * 60 * 1000),
      image_url: "https://x/y.png",
    });
    expect(r.displayStatus).toBe("failed");
    expect(r.isStale).toBe(true);
  });

  it("keeps recent in-flight publishing as publishing", () => {
    const r = resolveDisplayStatus({
      status: "publishing",
      page_results: [],
      updated_at: ago(30 * 1000),
    });
    expect(r.displayStatus).toBe("publishing");
  });

  it("does not transform a row that is already published", () => {
    const r = resolveDisplayStatus({
      status: "published",
      page_results: [],
      updated_at: ago(60 * 1000),
    });
    expect(r.displayStatus).toBe("published");
  });

  it("respects the 20-minute video stale window", () => {
    // 4 min on a video post is NOT stale yet (cutoff is 20 min)
    const r = resolveDisplayStatus({
      status: "publishing",
      page_results: [{ name: "A", status: "pending" }],
      updated_at: ago(4 * 60 * 1000),
      content_type: "reel",
      image_url: "https://x/y.mp4",
    });
    expect(r.displayStatus).toBe("publishing");
  });
});
