import { useState } from "react";
import { FileText, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { InboxEmail } from "./InboxEmailList";

interface EmailSummaryBannerProps {
  email: InboxEmail;
}

export function EmailSummaryBanner({ email }: EmailSummaryBannerProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleSummarize = async () => {
    if (summary) {
      setExpanded(!expanded);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-email", {
        body: {
          action: "summarize-email",
          emailSubject: email.subject,
          emailBody: email.body || email.preview,
          senderName: email.sender,
        },
      });
      if (error) throw error;
      if (data?.summary) {
        setSummary(data.summary);
        setExpanded(true);
      }
    } catch (err) {
      console.error("Summarize error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="shrink-0">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs h-7"
        onClick={handleSummarize}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileText className="w-3.5 h-3.5" />
        )}
        {summary ? (expanded ? "Hide" : "Show") + " Summary" : "Summarize"}
        {summary && (expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </Button>
      {summary && expanded && (
        <div className="mx-4 mb-2 p-3 rounded-lg bg-primary/5 border border-primary/10 text-xs leading-relaxed whitespace-pre-line">
          {summary}
        </div>
      )}
    </div>
  );
}
