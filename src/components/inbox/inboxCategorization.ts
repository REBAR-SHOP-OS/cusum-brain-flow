/**
 * Email categorization utilities — extracted from InboxView.tsx
 * Handles AI category mapping and keyword-based fallback classification.
 */

// AI category → label/color mapping
export function aiCategoryToLabel(
  category: string,
  urgency: string
): { label: string; labelColor: string; priority: number } {
  switch (category) {
    case "RFQ":
      return {
        label: urgency === "high" ? "Urgent" : "To Respond",
        labelColor: urgency === "high" ? "bg-red-500" : "bg-red-400",
        priority: urgency === "high" ? 0 : 1,
      };
    case "Active Customer":
      return { label: "To Respond", labelColor: "bg-red-400", priority: 1 };
    case "Payment":
      return { label: "FYI", labelColor: "bg-amber-400", priority: 2 };
    case "Vendor":
      return { label: "Awaiting Reply", labelColor: "bg-amber-400", priority: 3 };
    case "Internal":
      return { label: "Notification", labelColor: "bg-cyan-400", priority: 4 };
    case "Marketing":
      return { label: "Marketing", labelColor: "bg-pink-400", priority: 5 };
    case "Spam":
      return { label: "Spam", labelColor: "bg-gray-500", priority: 6 };
    default:
      return { label: "To Respond", labelColor: "bg-red-400", priority: 1 };
  }
}

export function categorizeCommunication(
  from: string,
  subject: string,
  preview: string,
  type: "email" | "call" | "sms" | "voicemail" | "fax",
  aiCategory?: string | null,
  aiUrgency?: string | null
): { label: string; labelColor: string; priority: number } {
  // Use AI classification if available
  if (aiCategory) {
    return aiCategoryToLabel(aiCategory, aiUrgency || "medium");
  }

  // Fallback to keyword-based
  const fromLower = from.toLowerCase();
  const subjectLower = (subject || "").toLowerCase();
  const previewLower = (preview || "").toLowerCase();

  if (type === "call") {
    if (subjectLower.includes("missed"))
      return { label: "Urgent", labelColor: "bg-red-500", priority: 0 };
    return { label: "To Respond", labelColor: "bg-red-400", priority: 1 };
  }
  if (type === "sms") {
    if (
      subjectLower.includes("urgent") ||
      previewLower.includes("urgent") ||
      previewLower.includes("asap")
    ) {
      return { label: "Urgent", labelColor: "bg-red-500", priority: 0 };
    }
    return { label: "To Respond", labelColor: "bg-red-400", priority: 1 };
  }

  if (
    fromLower.includes("mailer-daemon") ||
    fromLower.includes("postmaster") ||
    subjectLower.includes("delivery status")
  ) {
    return { label: "Notification", labelColor: "bg-cyan-400", priority: 4 };
  }
  if (
    fromLower.includes("noreply") ||
    fromLower.includes("no-reply") ||
    fromLower.includes("newsletter") ||
    fromLower.includes("marketing")
  ) {
    return { label: "Marketing", labelColor: "bg-pink-400", priority: 5 };
  }
  if (
    subjectLower.includes("security") ||
    subjectLower.includes("access code") ||
    subjectLower.includes("verification")
  ) {
    return { label: "Notification", labelColor: "bg-cyan-400", priority: 4 };
  }
  if (
    subjectLower.includes("invoice") ||
    subjectLower.includes("payment") ||
    subjectLower.includes("transfer")
  ) {
    return { label: "FYI", labelColor: "bg-amber-400", priority: 2 };
  }
  if (subjectLower.includes("support case") || subjectLower.includes("ticket")) {
    return { label: "Awaiting Reply", labelColor: "bg-amber-400", priority: 3 };
  }
  if (
    subjectLower.includes("urgent") ||
    subjectLower.includes("asap") ||
    subjectLower.includes("important")
  ) {
    return { label: "Urgent", labelColor: "bg-red-500", priority: 0 };
  }
  if (
    subjectLower.includes("spam") ||
    fromLower.includes("alibaba") ||
    subjectLower.includes("unsubscribe")
  ) {
    return { label: "Spam", labelColor: "bg-gray-500", priority: 6 };
  }
  return { label: "To Respond", labelColor: "bg-red-400", priority: 1 };
}

export function extractSenderName(fromAddress: string): string {
  const match = fromAddress.match(/^([^<]+)</);
  if (match) return match[1].trim();
  const emailMatch = fromAddress.match(/([^@]+)@/);
  if (emailMatch)
    return emailMatch[1]
      .replace(/[._]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  return fromAddress;
}

export function extractEmail(fromAddress: string): string {
  const match = fromAddress.match(/<([^>]+)>/);
  if (match) return match[1];
  return fromAddress;
}

export const labelFilters = [
  { label: "All", value: "all" },
  { label: "⭐ Starred", value: "starred" },
  { label: "Follow-up", value: "follow-up", color: "bg-orange-400" },
  { label: "To Respond", value: "To Respond", color: "bg-red-400" },
  { label: "Urgent", value: "Urgent", color: "bg-red-500" },
  { label: "FYI", value: "FYI", color: "bg-amber-400" },
  { label: "Awaiting Reply", value: "Awaiting Reply", color: "bg-amber-400" },
  { label: "Notification", value: "Notification", color: "bg-cyan-400" },
  { label: "Marketing", value: "Marketing", color: "bg-pink-400" },
  { label: "Spam", value: "Spam", color: "bg-gray-500" },
];
