import { useState } from "react";
import { Mail, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { sendGmailMessage } from "@/lib/gmail";
import { useToast } from "@/hooks/use-toast";

interface ComposeEmailProps {
  onClose: () => void;
  onSent: () => void;
  replyTo?: {
    to: string;
    subject: string;
    threadId: string;
    messageId?: string;
  };
}

export function ComposeEmail({ onClose, onSent, replyTo }: ComposeEmailProps) {
  const [to, setTo] = useState(replyTo?.to || "");
  const [subject, setSubject] = useState(replyTo?.subject ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, "")}` : "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
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
            <Textarea
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
