export const TEAM_HUB_SELF_NOTES_ID = "__my_notes__";

export const TEAM_HUB_ADMIN_EMAILS = [
  "radin@rebar.shop",
  "neel@rebar.shop",
  "sattar@rebar.shop",
] as const;

export const TEAM_HUB_OFFICIAL_WRITER_EMAILS = TEAM_HUB_ADMIN_EMAILS;

export const TEAM_HUB_PROTECTED_CHANNELS = [
  "Official Channel",
  "Official Group",
  "My Notes",
] as const;

export function isTeamHubAdmin(email?: string | null) {
  return TEAM_HUB_ADMIN_EMAILS.includes(
    (email ?? "") as (typeof TEAM_HUB_ADMIN_EMAILS)[number],
  );
}

export function canWriteToTeamHubChannel(
  channelName: string | undefined,
  email?: string | null,
) {
  return channelName !== "Official Channel" || isTeamHubAdmin(email);
}

export function formatForwardPrefix(senderName?: string | null) {
  return `↪ Forwarded from ${senderName || "Unknown"}:\n`;
}

export function buildRealtimeChannelName(
  scope: string,
  ...parts: Array<string | null | undefined>
) {
  return [scope, ...parts.filter(Boolean)].join("-");
}
