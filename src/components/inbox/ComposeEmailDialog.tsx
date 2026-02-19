import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SmartTextarea } from "@/components/ui/SmartTextarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EmailTemplatesDrawer } from "./EmailTemplatesDrawer";
import { AISuggestButton } from "@/components/ui/AISuggestButton";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import {
  Send,
  Loader2,
  Sparkles,
  RefreshCw,
  Bold,
  Italic,
  List,
  Paperclip,
  Mic,
  MicOff,
  Wand2,
} from "lucide-react";

const TONES = [
  { key: "formal", label: "Formal" },
  { key: "casual", label: "Casual" },
  { key: "friendly", label: "Friendly" },
  { key: "urgent", label: "Urgent" },
  { key: "shorter", label: "Shorter" },
  { key: "longer", label: "Longer" },
] as const;

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComposeEmailDialog({ open, onOpenChange }: ComposeEmailDialogProps) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [prompt, setPrompt] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [hasDrafted, setHasDrafted] = useState(false);
  const [adjustingTone, setAdjustingTone] = useState<string | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const speech = useSpeechRecognition({
    onError: (err) => toast({ title: "Voice error", description: err, variant: "destructive" }),
  });

  // Sync speech transcript into prompt field
  const currentTranscript = speech.fullTranscript + (speech.interimText ? ` ${speech.interimText}` : "");

  const reset = () => {
    setTo("");
    setSubject("");
    setBody("");
    setPrompt("");
    setHasDrafted(false);
    setDrafting(false);
    setSending(false);
    setPolishing(false);
    setAdjustingTone(null);
    speech.reset();
  };

  const handlePromptGenerate = async () => {
    const promptText = prompt.trim() || currentTranscript.trim();
    if (!promptText) {
      toast({ title: "Enter a prompt first", variant: "destructive" });
      return;
    }
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-email", {
        body: {
          action: "prompt-to-draft",
          prompt: promptText,
          recipientName: to || undefined,
          emailSubject: subject || undefined,
        },
      });
      if (error) throw error;
      if (data?.draft) {
        setBody(data.draft);
        setHasDrafted(true);
        speech.reset();
        toast({ title: "Draft generated from prompt" });
      }
    } catch (err) {
      toast({
        title: "Failed to generate draft",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setDrafting(false);
    }
  };

  const handleAiDraft = async () => {
    if (!subject.trim()) {
      toast({ title: "Enter a subject first", variant: "destructive" });
      return;
    }
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-email", {
        body: {
          emailSubject: subject,
          emailBody: "",
          senderName: to || "recipient",
          senderEmail: to,
        },
      });
      if (error) throw error;
      if (data?.draft) {
        setBody(data.draft);
        setHasDrafted(true);
        toast({ title: "Draft ready", description: "AI draft generated — review before sending." });
      }
    } catch (err) {
      toast({
        title: "Failed to generate draft",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setDrafting(false);
    }
  };

  const handlePolish = async () => {
    if (!body.trim()) {
      toast({ title: "Write or generate a draft first", variant: "destructive" });
      return;
    }
    setPolishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-email", {
        body: { action: "polish", draftText: body },
      });
      if (error) throw error;
      if (data?.draft) {
        setBody(data.draft);
        toast({ title: "Email polished ✨" });
      }
    } catch {
      toast({ title: "Failed to polish", variant: "destructive" });
    } finally {
      setPolishing(false);
    }
  };

  const handleToneAdjust = async (tone: string) => {
    if (!body.trim()) {
      toast({ title: "Write or generate a draft first", variant: "destructive" });
      return;
    }
    setAdjustingTone(tone);
    try {
      const { data, error } = await supabase.functions.invoke("draft-email", {
        body: { action: "adjust-tone", draftText: body, tone },
      });
      if (error) throw error;
      if (data?.draft) {
        setBody(data.draft);
        toast({ title: `Tone adjusted to ${tone}` });
      }
    } catch {
      toast({ title: "Failed to adjust tone", variant: "destructive" });
    } finally {
      setAdjustingTone(null);
    }
  };

  const handleSend = async () => {
    if (!to.trim() || !body.trim()) {
      toast({ title: "Missing fields", description: "Enter a recipient and message body.", variant: "destructive" });
      return;
    }

    setSending(true);
    const { dismiss } = toast({
      title: "Sending...",
      description: "Email will be sent in 5 seconds.",
      action: (
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={() => {
            if (undoTimerRef.current) {
              clearTimeout(undoTimerRef.current);
              undoTimerRef.current = null;
            }
            setSending(false);
            dismiss();
            toast({ title: "Send cancelled" });
          }}
        >
          Undo
        </Button>
      ),
      duration: 5500,
    });

    undoTimerRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("gmail-send", {
          body: {
            to,
            subject: subject || "(no subject)",
            body: body.replace(/\n/g, "<br>"),
          },
        });
        if (error) throw error;
        if (data?.error) {
          toast({ title: "Send failed", description: data.error, variant: "destructive" });
          setSending(false);
          return;
        }
        toast({ title: "Email sent", description: `Sent to ${to}` });
        reset();
        onOpenChange(false);
      } catch (err) {
        toast({
          title: "Failed to send",
          description: err instanceof Error ? err.message : "Please try again",
          variant: "destructive",
        });
      } finally {
        setSending(false);
      }
    }, 5000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm font-semibold">New Email</DialogTitle>
        </DialogHeader>

        {/* To */}
        <div className="px-4 py-1 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">To:</span>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
            />
          </div>
        </div>

        {/* Subject */}
        <div className="px-4 py-1 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Subject:</span>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject..."
              className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
            />
          </div>
        </div>

        {/* AI Prompt Input */}
        <div className="px-4 py-2 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <Input
              value={speech.isListening ? currentTranscript : prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to say..."
              className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
              disabled={speech.isListening}
            />
            {speech.isSupported && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => speech.isListening ? speech.stop() : speech.start()}
              >
                {speech.isListening ? (
                  <MicOff className="w-3.5 h-3.5 text-destructive" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs shrink-0 gap-1"
              onClick={handlePromptGenerate}
              disabled={drafting || sending || (!prompt.trim() && !currentTranscript.trim())}
            >
              {drafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Generate
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Body</span>
            <AISuggestButton
              contextType="email"
              context={`To: ${to}\nSubject: ${subject}`}
              currentText={body}
              onSuggestion={(text) => setBody(text)}
              label="Suggest"
              disabled={drafting || sending}
            />
          </div>
          <SmartTextarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email..."
            className="min-h-[160px] max-h-[280px] bg-card/50 border-border/50 resize-none text-sm"
          />
        </div>

        {/* Tone Adjuster + Polish */}
        {body.trim() && (
          <div className="flex items-center gap-1 px-4 py-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground mr-1">Tone:</span>
            {TONES.map((t) => (
              <Button
                key={t.key}
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px] rounded-full"
                disabled={!!adjustingTone || sending || polishing}
                onClick={() => handleToneAdjust(t.key)}
              >
                {adjustingTone === t.key ? <Loader2 className="w-3 h-3 animate-spin" /> : t.label}
              </Button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] rounded-full gap-1"
              disabled={!!adjustingTone || sending || polishing}
              onClick={handlePolish}
            >
              {polishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              Polish
            </Button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border">
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

            <EmailTemplatesDrawer onInsert={(text) => setBody(text)} currentDraft={body} />

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
              onClick={() => { reset(); onOpenChange(false); }}
            >
              Discard
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-7 text-xs"
              disabled={!to.trim() || !body.trim() || sending}
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
      </DialogContent>
    </Dialog>
  );
}
