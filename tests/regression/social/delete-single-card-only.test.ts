// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression: deleting a post card must remove ONLY that post, never
 * cascade to other posts sharing the same platform/title/day.
 *
 * Original bug: handleDelete computed `siblings` and deleted every matching id,
 * so clicking Delete on one card wiped unrelated cards on the same day.
 */
describe("PostReviewPanel handleDelete — single-card only", () => {
  const source = readFileSync(
    resolve(__dirname, "../../../src/components/social/PostReviewPanel.tsx"),
    "utf-8",
  );

  it("does not compute a siblings list inside handleDelete", () => {
    const handleDeleteMatch = source.match(/const handleDelete = async \(\) => \{[\s\S]*?\n {2}\};/);
    expect(handleDeleteMatch, "handleDelete block not found").toBeTruthy();
    const body = handleDeleteMatch![0];
    expect(body).not.toMatch(/siblings/);
    expect(body).not.toMatch(/idsToDelete/);
    expect(body).not.toMatch(/Promise\.all/);
  });

  it("calls deletePost.mutateAsync exactly with post.id", () => {
    const handleDeleteMatch = source.match(/const handleDelete = async \(\) => \{[\s\S]*?\n {2}\};/)!;
    expect(handleDeleteMatch[0]).toMatch(/deletePost\.mutateAsync\(post\.id\)/);
  });
});
