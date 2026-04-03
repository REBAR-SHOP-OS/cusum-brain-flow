import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { normalizeTeamMessageRow } from "../useTeamChat";

const TEAM_CHAT_SOURCE = fs.readFileSync(path.resolve(__dirname, "../useTeamChat.ts"), "utf-8");

describe("normalizeTeamMessageRow", () => {
  it("coerces null translations to empty object", () => {
    const m = normalizeTeamMessageRow({
      id: "1",
      channel_id: "c1",
      sender_profile_id: "p1",
      original_text: "hi",
      original_language: "en",
      translations: null,
      attachments: [],
      reply_to_id: null,
      created_at: "2020-01-01T00:00:00.000Z",
    });
    expect(m.translations).toEqual({});
  });

  it("filters non-string translation values", () => {
    const m = normalizeTeamMessageRow({
      id: "1",
      channel_id: "c1",
      sender_profile_id: "p1",
      original_text: "x",
      original_language: "en",
      translations: { en: "ok", bad: 1 as unknown as string },
      attachments: [],
      reply_to_id: null,
      created_at: "2020-01-01T00:00:00.000Z",
    });
    expect(m.translations).toEqual({ en: "ok" });
  });

  it("coerces null original_text to empty string", () => {
    const m = normalizeTeamMessageRow({
      id: "1",
      channel_id: "c1",
      sender_profile_id: "p1",
      original_text: null,
      original_language: "en",
      translations: {},
      attachments: [],
      reply_to_id: null,
      created_at: "2020-01-01T00:00:00.000Z",
    });
    expect(m.original_text).toBe("");
  });
});

describe("useTeamChat — query key user scoping", () => {
  it("team-channels queryKey includes authenticated user id", () => {
    expect(TEAM_CHAT_SOURCE).toContain('queryKey: ["team-channels", user?.id]');
  });

  it("team-messages queryKey includes user id and channelId", () => {
    expect(TEAM_CHAT_SOURCE).toContain('queryKey: ["team-messages", user?.id, channelId]');
  });
});
