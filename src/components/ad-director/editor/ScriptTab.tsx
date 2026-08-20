import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Image, Mic, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { ScriptSegment } from "@/types/adDirector";

interface ScriptTabProps {
  segments: ScriptSegment[];
  onUpdateSegment?: (id: string, text: string) => void;
}

export function ScriptTab({ segments, onUpdateSegment }: ScriptTabProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [voiceoverId, setVoiceoverId] = useState<string | null>(null);

  const startEdit = (seg: ScriptSegment) => {
    setEditingId(seg.id);
    setEditText(seg.text);
  };

  const saveEdit = (id: string) => {
    onUpdateSegment?.(id, editText);
    setEditingId(null);
    toast({ title: "Segment updated" });
  };

  const handleVoiceover = async (seg: ScriptSegment) => {
    setVoiceoverId(seg.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: seg.text }),
        }
      );
      if (!response.ok) throw new Error(`TTS failed: ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      toast({ title: "Voiceover preview", description: `Playing: "${seg.label}"` });
    } catch (err: any) {
      toast({ title: "Voiceover failed", description: err.message, variant: "destructive" });
    } finally {
      setVoiceoverId(null);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Script Chapters</h4>

      {segments.map((seg) => (
        <div key={seg.id} className="rounded-lg border border-border/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[9px]">{seg.type}</Badge>
              <span className="text-xs font-medium">{seg.label}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {seg.startTime.toFixed(0)}s – {seg.endTime.toFixed(0)}s
            </span>
          </div>

          {editingId === seg.id ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full text-xs bg-muted/30 border border-border/30 rounded-md p-2 min-h-[60px] resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => saveEdit(seg.id)}>Save</Button>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setEditingId(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p
              className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => startEdit(seg)}
            >
              {seg.text}
            </p>
          )}

          {/* Actions row */}
          <div className="flex gap-1.5 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-1.5 gap-1"
              onClick={() => toast({ title: "Coming soon", description: "Add segment is under development" })}
            >
              <Plus className="w-3 h-3" /> Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-1.5 gap-1"
              onClick={() => toast({ title: "Coming soon", description: "Stock media integration is under development" })}
            >
              <Image className="w-3 h-3" /> Stock media
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-1.5 gap-1"
              onClick={() => handleVoiceover(seg)}
              disabled={voiceoverId === seg.id}
            >
              {voiceoverId === seg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mic className="w-3 h-3" />} Voiceover
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
