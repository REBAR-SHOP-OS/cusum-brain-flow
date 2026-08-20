import { supabase } from "@/integrations/supabase/client";

export async function sendGmailMessage(options: {
  to: string;
  cc?: string;
  bcc?: string;
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

