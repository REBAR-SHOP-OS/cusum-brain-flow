import { useState, useEffect } from "react";
import { Mail, Send, X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SmartTextarea } from "@/components/ui/SmartTextarea";
import { Label } from "@/components/ui/label";
import { sendGmailMessage } from "@/lib/gmail";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ComposeEmailProps {
  onClose: () => void;
  onSent: () => void;
  replyTo?: {
    to: string;
    subject: string;
    threadId: string;
    messageId?: string;
    originalBody?: string;
  };
}

export function ComposeEmail({ onClose, onSent, replyTo }: ComposeEmailProps) {
  const [to, setTo] = useState(replyTo?.to || "");
  const [subject, setSubject] = useState(replyTo?.subject ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, "")}` : "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const { toast } = useToast();

  // Fetch smart reply suggestions when replying
  useEffect(() => {
    if (replyTo?.originalBody) {
      fetchSuggestions();
    }
  }, [replyTo?.originalBody]);

  const fetchSuggestions = async () => {
    if (!replyTo?.originalBody) return;
    
    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-agent", {
        body: {
          agent: "sales",
          message: `Generate 3 brief, professional email reply suggestions for this email. Return ONLY a JSON array of 3 strings, each being a complete reply (2-3 sentences max). No explanation, just the JSON array.

Email subject: ${replyTo.subject}
Email body: ${replyTo.originalBody.substring(0, 1000)}`,
        },
      });

      if (error) throw error;

      // Parse the AI response to extract suggestions
      const reply = data?.reply || "";
      try {
        // Try to extract JSON array from the response
        const jsonMatch = reply.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSuggestions(parsed.slice(0, 3));
          }
        }
      } catch {
        // If parsing fails, try to split by newlines or numbers
        const lines = reply.split(/\n/).filter((l: string) => l.trim().length > 20);
        if (lines.length > 0) {
          setSuggestions(lines.slice(0, 3).map((l: string) => l.replace(/^\d+[\.\)]\s*/, "").replace(/^["']|["']$/g, "")));
        }
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast({ title: "Missing fields", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      await sendGmailMessage({
        to,
        subject,
        body: body.replace(/\n/g, "<br>"),
        threadId: replyTo?.threadId,
        replyToMessageId: replyTo?.messageId,
      });
      toast({ title: "Email sent", description: `Sent to ${to}` });
      onSent();
      onClose();
    } catch (error) {
      toast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const applySuggestion = (suggestion: string) => {
    setBody(suggestion);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <span className="font-medium">{replyTo ? "Reply" : "New Message"}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Smart Reply Suggestions */}
        {replyTo && (
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Smart Replies</span>
              {loadingSuggestions && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </div>
            {loadingSuggestions ? (
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 flex-1 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-2 px-3 text-left whitespace-normal max-w-full"
                    onClick={() => applySuggestion(suggestion)}
                  >
                    <span className="line-clamp-2">{suggestion.substring(0, 80)}...</span>
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No suggestions available</p>
            )}
          </div>
        )}

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="email"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-secondary border-0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="bg-secondary border-0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
          <SmartTextarea
              id="body"
              placeholder="Write your message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="bg-secondary border-0 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            <Send className="w-4 h-4 mr-2" />
            {sending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}