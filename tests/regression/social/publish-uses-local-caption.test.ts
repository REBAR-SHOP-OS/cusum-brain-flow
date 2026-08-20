// Regression: PostReviewPanel Publish Now must flush local edits and pass
// `localContent`/`localTitle`/`localHashtags` (via contentToSave + hashtagArray)
// to publishPost, NOT the stale `post.content` / `post.title` / `post.hashtags`
// props. Otherwise captions typed right before clicking Publish are dropped
// because the 1.5s debounced auto-save hasn't fired yet.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../../src/components/social/PostReviewPanel.tsx"),
  "utf8",
);

describe("PostReviewPanel Publish Now caption flush", () => {
  it("does not pass post.content / post.title / post.hashtags to publishPost", () => {
    // Isolate the Publish Now handler block (between the 'Publish Now' button
    // label and the next 'Decline' button).
    const start = src.indexOf("// First platform: use original row");
    const end = src.indexOf("if (allOk) onClose();", start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const block = src.slice(start, end);

    expect(block).not.toMatch(/content:\s*post\.content/);
    expect(block).not.toMatch(/title:\s*post\.title/);
    expect(block).not.toMatch(/hashtags:\s*post\.hashtags/);
  });

  it("flushes via updatePost.mutateAsync before invoking publishPost", () => {
    const flushIdx = src.indexOf("await updatePost.mutateAsync");
    const publishIdx = src.indexOf("await publishPost({", flushIdx);
    expect(flushIdx).toBeGreaterThan(0);
    expect(publishIdx).toBeGreaterThan(flushIdx);
  });
});
