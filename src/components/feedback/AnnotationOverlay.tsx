import { useRef, useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Undo2, Trash2, Send, Loader2, Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

const COLORS = ["#ef4444", "#3b82f6", "#eab308"] as const;
const LINE_WIDTH = 3;

const SATTAR_PROFILE_ID = "ee659c5c-20e1-4bf5-a01d-dedd886a4ad7";
const RADIN_PROFILE_ID = "5d948a66-619b-4ee1-b5e3-063194db7171";

interface Props {
  open: boolean;
  onClose: () => void;
  screenshotDataUrl: string;
}

export function AnnotationOverlay({ open, onClose, screenshotDataUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState<string>(COLORS[0]);
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const { companyId } = useCompanyId();

  // Web Speech API — Google Voice, supports Farsi + English, no WebSocket errors
  const speech = useSpeechRecognition({
    lang: "fa-IR",
    onError: (err) => toast.error(err),
  });

  // Track already-appended transcript IDs to avoid double-appending
  const appendedIdsRef = useRef<Set<string>>(new Set());

  // Append new final transcripts to description
  useEffect(() => {
    for (const t of speech.transcripts) {
      if (!appendedIdsRef.current.has(t.id)) {
        appendedIdsRef.current.add(t.id);
        setDescription((prev) => (prev ? prev + " " + t.text : t.text).trim());
      }
    }
  }, [speech.transcripts]);

  // Stop voice when dialog closes
  useEffect(() => {
    if (!open) {
      speech.stop();
      appendedIdsRef.current.clear();
    }
  }, [open, speech.stop]);

  // Load background image once
  useEffect(() => {
    if (!screenshotDataUrl) return;
    const img = new Image();
    img.onload = () => {
      bgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    };
    img.src = screenshotDataUrl;
  }, [screenshotDataUrl]);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return {
        x: (t.clientX - rect.left) * scaleX,
        y: (t.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const pos = getPos(e);
      ctx.strokeStyle = color;
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      setIsDrawing(true);
    },
    [color, getPos]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasDrawn(true);
    },
    [isDrawing, getPos]
  );

  const stopDraw = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    setHistory((prev) => [
      ...prev,
      ctx.getImageData(0, 0, canvas.width, canvas.height),
    ]);
  }, [isDrawing]);

  const undo = useCallback(() => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const newHist = history.slice(0, -1);
    ctx.putImageData(newHist[newHist.length - 1], 0, 0);
    setHistory(newHist);
    if (newHist.length <= 1) setHasDrawn(false);
  }, [history]);

  const clearAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !bgRef.current) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bgRef.current, 0, 0);
    const base = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([base]);
    setHasDrawn(false);
  }, []);

  const canSend = hasDrawn || description.trim().length > 0;

  const handleSend = useCallback(async () => {
    if (!canSend || sending) return;
    // Stop voice recording if active
    speech.stop();
    setSending(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("No canvas");

      // Export canvas as blob
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error("toBlob failed"))),
          "image/png"
        )
      );

      const ts = Date.now();
      const path = `feedback-screenshots/${companyId ?? "unknown"}/${ts}.png`;

      const { error: uploadErr } = await supabase.storage
        .from("clearance-photos")
        .upload(path, blob, { contentType: "image/png", upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("clearance-photos")
        .getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id;

      // Look up submitter's profile
      let submitterProfileId: string | null = null;
      let submitterName = "Unknown";
      if (userId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("user_id", userId)
          .maybeSingle();
        if (prof) {
          submitterProfileId = prof.id;
          submitterName = prof.full_name || "Unknown";
        }
      }

      // Get current page for context
      const pagePath = window.location.pathname;

      // Create tasks for both assignees
      for (const profileId of [SATTAR_PROFILE_ID, RADIN_PROFILE_ID]) {
        const { error: taskErr } = await supabase.from("tasks").insert({
          title: `Feedback: ${
            description.trim().slice(0, 80) || "Screenshot annotation"
          }`,
          description: `${description.trim()}\n\nFrom: ${submitterName}\nPage: ${pagePath}\nScreenshot: ${publicUrl}`,
          status: "pending",
          priority: "high",
          assigned_to: profileId,
          company_id: companyId ?? "a0000000-0000-0000-0000-000000000001",
          created_by_profile_id: submitterProfileId,
          source: "screenshot_feedback",
          attachment_url: publicUrl,
        } as any);
        if (taskErr) throw taskErr;
      }

      // Create notifications — translated to each recipient's preferred_language
      for (const profileId of [SATTAR_PROFILE_ID, RADIN_PROFILE_ID]) {
        const { data: targetProf } = await supabase
          .from("profiles")
          .select("user_id, preferred_language")
          .eq("id", profileId)
          .maybeSingle();

        if (!targetProf?.user_id) continue;

        const lang = (targetProf.preferred_language as string) || "en";
        let notifTitle = "📸 Screenshot Feedback";
        let notifDesc =
          description.trim().slice(0, 200) || "New annotated screenshot";

        // Translate if recipient's language is not English
        if (lang !== "en") {
          try {
            const { data: translated } = await supabase.functions.invoke(
              "translate-message",
              {
                body: {
                  text: notifTitle + "\n" + notifDesc,
                  sourceLang: "en",
                  targetLangs: [lang],
                },
              }
            );
            const translatedText: string | undefined =
              translated?.translations?.[lang];
            if (translatedText) {
              const parts = translatedText.split("\n");
              notifTitle = parts[0] ?? notifTitle;
              notifDesc = parts.slice(1).join("\n").trim() || notifDesc;
            }
          } catch (translateErr) {
            console.warn("Translation failed, using English:", translateErr);
          }
        }

        await supabase.from("notifications").insert({
          user_id: targetProf.user_id,
          type: "notification",
          title: notifTitle,
          description: notifDesc,
          priority: "high",
          link_to: "/tasks",
          agent_name: "Feedback",
          status: "unread",
          metadata: { screenshot_url: publicUrl, page: pagePath },
        });
      }

      toast.success("Feedback sent!");
      setDescription("");
      setHasDrawn(false);
      setHistory([]);
      appendedIdsRef.current.clear();
      onClose();
    } catch (err: any) {
      console.error("Feedback send error:", err);
      toast.error("Failed to send feedback: " + (err.message ?? "Unknown error"));
    } finally {
      setSending(false);
    }
  }, [canSend, sending, companyId, description, onClose, speech.stop]);

  const toggleVoice = useCallback(() => {
    if (speech.isListening) {
      speech.stop();
    } else {
      speech.start();
    }
  }, [speech.isListening, speech.start, speech.stop]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] flex flex-col p-3 gap-2">
        <DialogTitle className="text-sm font-semibold">
          Annotate & Describe the Change
        </DialogTitle>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-6 h-6 rounded-full border-2 transition-transform"
              style={{
                backgroundColor: c,
                borderColor:
                  color === c ? "hsl(var(--foreground))" : "transparent",
                transform: color === c ? "scale(1.2)" : "scale(1)",
              }}
              aria-label={`Color ${c}`}
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={history.length <= 1}
          >
            <Undo2 className="w-4 h-4 mr-1" /> Undo
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <Trash2 className="w-4 h-4 mr-1" /> Clear
          </Button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto border rounded-md bg-muted/30">
          <canvas
            ref={canvasRef}
            className="w-full cursor-crosshair touch-none"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
        </div>

        {/* Description + Voice + Send */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Textarea
              placeholder="توضیح تغییر مورد نیاز را بنویسید یا با میکروفون بگویید..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[60px] max-h-[100px] w-full"
            />
            {/* Live interim text from Web Speech API */}
            {speech.interimText && (
              <div className="mt-1 text-xs italic text-muted-foreground px-1 animate-pulse">
                🎙 {speech.interimText}
              </div>
            )}
          </div>

          {/* Voice button */}
          <Button
            type="button"
            variant={speech.isListening ? "destructive" : "outline"}
            size="icon"
            onClick={toggleVoice}
            disabled={!speech.isSupported}
            title={
              !speech.isSupported
                ? "Voice input not supported in this browser"
                : speech.isListening
                ? "Stop voice input"
                : "Start voice input (supports Farsi & English)"
            }
            className="shrink-0"
          >
            {speech.isListening ? (
              <MicOff className="w-4 h-4 animate-pulse" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </Button>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!canSend || sending}
            className="shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Send className="w-4 h-4 mr-1" />
            )}
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
