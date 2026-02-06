import { useState } from "react";
import { X, ExternalLink, Sparkles, Trash2, Send, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { InboxEmail } from "./InboxEmailList";

interface InboxEmailViewerProps {
  email: InboxEmail | null;
  onClose: () => void;
}

export function InboxEmailViewer({ email, onClose }: InboxEmailViewerProps) {
  const [replyText, setReplyText] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [hasDrafted, setHasDrafted] = useState(false);
  const { toast } = useToast();

  const handleAiDraft = async () => {
    if (!email) return;
    setDrafting(true);

    try {
      const { data, error } = await supabase.functions.invoke("draft-email", {
        body: {
          emailSubject: email.subject,
          emailBody: email.body || email.preview,
          senderName: email.sender,
          senderEmail: email.senderEmail,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: "AI Draft Error", description: data.error, variant: "destructive" });
        return;
      }

      if (data?.draft) {
        setReplyText(data.draft);
        setHasDrafted(true);
        toast({ title: "Draft ready", description: "AI draft generated — review before sending." });
      }
    } catch (err) {
      console.error("AI Draft error:", err);
      toast({
        title: "Failed to generate draft",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setDrafting(false);
    }
  };

  if (!email) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Select an email to read</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background border-l">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
        <button className="text-muted-foreground hover:text-foreground">
          <ExternalLink className="w-5 h-5" />
        </button>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Label */}
        <span className={cn(
          "inline-block px-2 py-0.5 rounded text-xs text-white mb-4",
          email.labelColor
        )}>
          {email.label}
        </span>

        {/* Sender Info */}
        <div className="flex items-center justify-between mb-1">
          <div>
            <span className="font-medium">{email.sender}</span>
            <span className="text-muted-foreground"> | {email.senderEmail}</span>
          </div>
          <span className="text-sm text-muted-foreground">{email.fullDate}</span>
        </div>
        
        {/* To address */}
        <p className="text-sm text-muted-foreground mb-6">To {email.toAddress}</p>

        {/* Email Body */}
        <div className="text-sm mb-8 whitespace-pre-wrap leading-relaxed">
          {email.body || email.preview}
        </div>

        {/* Reply Section */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>↩</span>
              <span>{email.senderEmail}</span>
            </div>
            <button
              onClick={handleAiDraft}
              disabled={drafting}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {drafting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasDrafted ? (
                <RefreshCw className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{drafting ? "Drafting..." : hasDrafted ? "Regenerate" : "AI Draft"}</span>
            </button>
          </div>
          
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write your reply..."
            className="min-h-[100px] bg-transparent border-0 p-0 resize-none focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between p-4 border-t">
        <Button variant="ghost" className="text-muted-foreground" onClick={() => { setReplyText(""); setHasDrafted(false); }}>
          <Trash2 className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button className="bg-[#4FC3F7] hover:bg-[#4FC3F7]/90 text-white" disabled={!replyText.trim()}>
          Send
          <Send className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
