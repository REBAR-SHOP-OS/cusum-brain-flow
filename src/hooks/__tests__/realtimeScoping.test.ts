import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Realtime channel scoping tests.
 * Verifies all .channel() calls use dynamic names scoped by companyId, userId, or instance ID.
 * Static string channel names cause cross-tenant broadcast noise at scale.
 */

const SRC_ROOT = path.resolve(__dirname, "../..");

function findChannelCalls(filePath: string): { line: number; channel: string }[] {
  let source: string;
  try {
    source = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const results: { line: number; channel: string }[] = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/\.channel\(([^)]+)\)/);
    if (match) {
      results.push({ line: i + 1, channel: match[1].trim() });
    }
  }

  return results;
}

function isDynamic(channelArg: string): boolean {
  // Dynamic channels use template literals or string concatenation
  return (
    channelArg.includes("`") || // template literal
    channelArg.includes("+") || // string concatenation
    channelArg.includes("$") // interpolation inside template
  );
}

// Files with realtime subscriptions
const REALTIME_FILES = [
  "hooks/useProjects.ts",
  "hooks/useProductionQueues.ts",
  "hooks/usePickupOrders.ts",
  "hooks/usePipelineRealtime.ts",
  "hooks/useTimeClock.ts",
  "hooks/useCutPlans.ts",
  "hooks/useExtractSessions.ts",
  "hooks/useBarlists.ts",
  "hooks/useRCPresence.ts",
  "hooks/useLiveMonitorStats.ts",
  "hooks/useLiveMonitorData.ts",
  "hooks/useInventoryData.ts",
  "hooks/usePennyQueue.ts",
  "hooks/useNotifications.ts",
  "hooks/useLeaveManagement.ts",
  "hooks/useTeamChat.ts",
  "hooks/useCompletedBundles.ts",
  "hooks/useClearanceData.ts",
  "hooks/useTeamMeetings.ts",
  "hooks/useMeetingTranscription.ts",
  "components/support/SupportConversationList.tsx",
  "components/support/SupportChatView.tsx",
  "pages/Deliveries.tsx",
];

describe("Realtime channel scoping", () => {
  it("all realtime channels use dynamic names (not static strings)", () => {
    const staticChannels: string[] = [];

    for (const file of REALTIME_FILES) {
      const fullPath = path.resolve(SRC_ROOT, file);
      const calls = findChannelCalls(fullPath);

      for (const call of calls) {
        if (!isDynamic(call.channel)) {
          staticChannels.push(`${file}:${call.line} → .channel(${call.channel})`);
        }
      }
    }

    expect(
      staticChannels,
      `Static channel names found (cross-tenant risk):\n${staticChannels.join("\n")}`
    ).toEqual([]);
  });

  it("channel names include companyId, userId, or unique instance ID", () => {
    const unscopedChannels: string[] = [];

    for (const file of REALTIME_FILES) {
      const fullPath = path.resolve(SRC_ROOT, file);
      const calls = findChannelCalls(fullPath);

      for (const call of calls) {
        const arg = call.channel;
        const hasScope =
          arg.includes("companyId") ||
          arg.includes("company_id") ||
          arg.includes("userId") ||
          arg.includes("user?.id") ||
          arg.includes("user.id") ||
          arg.includes("channelId") ||
          arg.includes("meetingId") ||
          arg.includes("conversationId") ||
          arg.includes("Math.random") || // instance-scoped
          arg.includes("random"); // instance-scoped

        if (!hasScope) {
          unscopedChannels.push(`${file}:${call.line} → .channel(${arg})`);
        }
      }
    }

    expect(
      unscopedChannels,
      `Unscoped channels (no companyId/userId/instanceId):\n${unscopedChannels.join("\n")}`
    ).toEqual([]);
  });

  it("at least 20 realtime channels exist across the codebase", () => {
    let total = 0;
    for (const file of REALTIME_FILES) {
      const fullPath = path.resolve(SRC_ROOT, file);
      total += findChannelCalls(fullPath).length;
    }
    expect(total).toBeGreaterThanOrEqual(20);
  });
});
