import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sendGmailMessage } from "@/lib/gmail";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Send } from "lucide-react";

interface Props {
  prospect: {
    id: string;
    company_name: string;
    contact_name: string;
    contact_title: string | null;
    email: string | null;
    city: string | null;
    industry: string | null;
    fit_reason: string | null;
    intro_angle: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}

export function ProspectIntroDialog({ prospect, open, onOpenChange, onSent }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [drafted, setDrafted] = useState(false);
  const { toast } = useToast();

  // Draft email via AI
  const draftMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("pipeline-ai", {
        body: {
          action: "draft_intro",
          lead: {
            title: prospect.company_name,
            customer_name: prospect.contact_name,
            notes: `Industry: ${prospect.industry}\nCity: ${prospect.city}\nFit: ${prospect.fit_reason}\nAngle: ${prospect.intro_angle}`,
          },
          userMessage: `Draft a cold introduction email to ${prospect.contact_name} (${prospect.contact_title}) at ${prospect.company_name}. Use this angle: ${prospect.intro_angle}. Keep it professional, concise, and non-spammy. The email is from rebar.shop — a Canadian rebar fabrication company.`,
        },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      setSubject(data.subject || `Introduction: rebar.shop × ${prospect.company_name}`);
      setBody(data.body || "");
      setDrafted(true);
    },
    onError: (err) => {
      toast({ title: "Draft failed", description: err.message, variant: "destructive" });
    },
  });

  // Send email
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!prospect.email) throw new Error("No email address");
      await sendGmailMessage({ to: prospect.email, subject, body });
    },
    onSuccess: () => {
      toast({ title: "Email sent!", description: `Introduction sent to ${prospect.email}` });
      onSent();
    },
    onError: (err) => {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Introduction — {prospect.company_name}</DialogTitle>
        </DialogHeader>

        {!drafted ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground text-center">
              AI will draft a personalized introduction email to{" "}
              <strong>{prospect.contact_name}</strong> at <strong>{prospect.company_name}</strong>
            </p>
            <Button onClick={() => draftMutation.mutate()} disabled={draftMutation.isPending} className="gap-2">
              {draftMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Draft
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input value={prospect.email || ""} disabled className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Subject</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Body</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="text-sm" />
            </div>
          </div>
        )}

        <DialogFooter>
          {drafted && (
            <>
              <Button variant="outline" size="sm" onClick={() => draftMutation.mutate()} disabled={draftMutation.isPending}>
                {draftMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                Regenerate
              </Button>
              <Button size="sm" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending} className="gap-1.5">
                {sendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Email
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
