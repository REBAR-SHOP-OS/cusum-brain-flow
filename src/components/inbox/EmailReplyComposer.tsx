import { useState } from "react";
import { Send, Loader2, Sparkles, RefreshCw, X, Paperclip, Bold, Italic, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { InboxEmail } from "./InboxEmailList";
import type { ReplyMode } from "./EmailActionBar";

interface EmailReplyComposerProps {
  email: InboxEmail;
  mode: ReplyMode;
  onClose: () => void;
}

export function EmailReplyComposer({ email, mode, onClose }: EmailReplyComposerProps) {
  const [replyText, setReplyText] = useState("");
  const [forwardTo, setForwardTo] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasDrafted, setHasDrafted] = useState(false);
  const { toast } = useToast();

  if (!mode) return null;

  const isForward = mode === "forward";
  const recipientLabel = isForward
    ? "To:"
    : mode === "reply-all"
      ? `To: ${email.senderEmail}, ${email.toAddress}`
      : `To: ${email.senderEmail}`;

  const subjectPrefix = isForward ? "Fwd:" : "Re:";
  const fullSubject = email.subject.startsWith(subjectPrefix)
    ? email.subject
    : `${subjectPrefix} ${email.subject}`;

  const handleAiDraft = async () => {
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

  const handleSend = async () => {
    if (!replyText.trim()) return;
    if (isForward && !forwardTo.trim()) {
      toast({ title: "Missing recipient", description: "Enter an email address to forward to.", variant: "destructive" });
      return;
    }
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("gmail-send", {
        body: {
          to: isForward ? forwardTo : email.senderEmail,
          subject: fullSubject,
          body: replyText.replace(/\n/g, "<br>"),
          threadId: isForward ? undefined : (email.threadId || undefined),
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Send failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({
        title: isForward ? "Email forwarded" : "Email sent",
        description: isForward ? `Forwarded to ${forwardTo}` : `Reply sent to ${email.sender}`,
      });
      setReplyText("");
      setHasDrafted(false);
      onClose();
    } catch (err) {
      console.error("Send email error:", err);
      toast({
        title: "Failed to send",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t bg-muted/10 shrink-0 max-h-[45vh] overflow-y-auto">
      {/* Composer Header */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {mode === "reply" ? "Reply" : mode === "reply-all" ? "Reply All" : "Forward"}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Recipient */}
      <div className="px-4 py-1">
        {isForward ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">To:</span>
            <Input
              value={forwardTo}
              onChange={(e) => setForwardTo(e.target.value)}
              placeholder="Enter email address..."
              className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{recipientLabel}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">Subject: {fullSubject}</p>
      </div>

      {/* Text Area */}
      <div className="px-4 py-1">
        <Textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder={isForward ? "Add a message..." : "Write your reply..."}
          className="min-h-[80px] max-h-[140px] bg-card/50 border-border/50 resize-none text-sm"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 pb-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Bold className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Italic className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <List className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={handleAiDraft}
            disabled={drafting || sending}
          >
            {drafting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : hasDrafted ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            )}
            <span>{drafting ? "Drafting..." : hasDrafted ? "Regenerate" : "AI Draft"}</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => { setReplyText(""); setHasDrafted(false); onClose(); }}
          >
            Discard
          </Button>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-7 text-xs"
            disabled={!replyText.trim() || sending || (isForward && !forwardTo.trim())}
            onClick={handleSend}
          >
            {sending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Send
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
