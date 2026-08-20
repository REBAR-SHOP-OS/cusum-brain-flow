// @vitest-environment node
/**
 * Regression: editing a single card (pages, content type, scheduled date) must
 * scope the DB update strictly to that card's id. Matching by title/platform/
 * scheduled_date overwrites sibling cards that share those values.
 *
 * This test inspects the source of PostReviewPanel.tsx to guarantee the three
 * known regression sites never reintroduce the broad sibling-match query.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../../src/components/social/PostReviewPanel.tsx"),
  "utf8"
);

describe("PostReviewPanel — card edits scoped to post.id", () => {
  it("handlePagesSaveMulti updates only by id", () => {
    const fn = SRC.split("const handlePagesSaveMulti")[1]?.split("\n  const ")[0] ?? "";
    expect(fn).toContain('.eq("id", post.id)');
    expect(fn).not.toMatch(/\.eq\("title"/);
    expect(fn).not.toMatch(/\.eq\("scheduled_date"/);
  });

  it("content type update is scoped by id only", () => {
    const slice = SRC.split('.update({ content_type:')[1]?.split(";")[0] ?? "";
    expect(slice).toContain('.eq("id", post.id)');
    expect(slice).not.toMatch(/\.eq\("title"/);
    expect(slice).not.toMatch(/\.eq\("scheduled_date"/);
  });

  it("onSetDate update is scoped by id only", () => {
    const slice = SRC.split("onSetDate={async (date)")[1]?.split("}}")[0] ?? "";
    expect(slice).toContain('.eq("id", post.id)');
    expect(slice).not.toMatch(/\.eq\("title"/);
    expect(slice).not.toMatch(/\.gte\("scheduled_date"/);
  });
});
