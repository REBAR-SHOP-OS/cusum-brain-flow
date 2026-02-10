import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { InboxEmail } from "./InboxEmailList";

interface QuickReplyChipsProps {
  email: InboxEmail;
  onSelectReply: (text: string) => void;
}

export function QuickReplyChips({ email, onSelectReply }: QuickReplyChipsProps) {
  const [replies, setReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchReplies = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-email", {
        body: {
          action: "quick-replies",
          emailSubject: email.subject,
          emailBody: email.body || email.preview,
          senderName: email.sender,
        },
      });
      if (error) throw error;
      if (data?.replies) {
        setReplies(data.replies);
        setLoaded(true);
      }
    } catch (err) {
      console.error("Quick replies error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!loaded && !loading) {
    return (
      <div className="px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-primary"
          onClick={fetchReplies}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Suggest Quick Replies
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Generating suggestions...
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide font-medium">Quick Replies</p>
      <div className="flex flex-wrap gap-1.5">
        {replies.map((reply, i) => (
          <button
            key={i}
            onClick={() => onSelectReply(reply)}
            className="px-3 py-1.5 rounded-full border border-border bg-card text-xs hover:bg-primary/10 hover:border-primary/30 transition-colors"
          >
            {reply}
          </button>
        ))}
      </div>
    </div>
  );
}
