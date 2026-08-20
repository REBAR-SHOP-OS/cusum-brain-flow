import { describe, it, expect } from "vitest";
import { stripMarkdownLinks } from "@/lib/stripMarkdownLinks";

describe("stripMarkdownLinks", () => {
  it("converts markdown links to plain text", () => {
    expect(stripMarkdownLinks("🌐 [www.rebar.shop](http://www.rebar.shop)")).toBe("🌐 www.rebar.shop");
  });
  it("leaves plain text untouched", () => {
    expect(stripMarkdownLinks("🌐 www.rebar.shop")).toBe("🌐 www.rebar.shop");
  });
  it("handles autolinks", () => {
    expect(stripMarkdownLinks("see <https://rebar.shop>")).toBe("see https://rebar.shop");
  });
  it("handles null", () => {
    expect(stripMarkdownLinks(null)).toBe("");
  });
});
