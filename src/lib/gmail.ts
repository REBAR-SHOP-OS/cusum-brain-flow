import { supabase } from "@/integrations/supabase/client";

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  internalDate: number;
  isUnread: boolean;
}

export interface GmailSyncResponse {
  messages: GmailMessage[];
  nextPageToken: string | null;
}

export async function fetchGmailMessages(options?: {
  maxResults?: number;
  pageToken?: string;
  query?: string;
}): Promise<GmailSyncResponse> {
  const { data, error } = await supabase.functions.invoke("gmail-sync", {
    body: {
      maxResults: options?.maxResults ?? 20,
      pageToken: options?.pageToken,
      query: options?.query,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to fetch emails");
  }

  return data as GmailSyncResponse;
}

export async function sendGmailMessage(options: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  replyToMessageId?: string;
}): Promise<{ success: boolean; messageId: string; threadId: string }> {
  const { data, error } = await supabase.functions.invoke("gmail-send", {
    body: options,
  });

  if (error) {
    throw new Error(error.message || "Failed to send email");
  }

  return data;
}

export function parseEmailAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  if (match) {
    return { name: match[1] || match[2], email: match[2] };
  }
  return { name: raw, email: raw };
}

export function formatDate(internalDate: number): string {
  const date = new Date(internalDate);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = diff / (1000 * 60 * 60 * 24);

  if (days < 1) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}
