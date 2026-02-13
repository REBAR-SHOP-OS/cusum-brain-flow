import { useState, useCallback } from "react";
import { Mic, MicOff, Save, Trash2 } from "lucide-react";
import { useRealtimeTranscribe } from "@/hooks/useRealtimeTranscribe";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function WatchMode() {
  const {
    isConnected,
    isConnecting,
    partialText,
    committedTranscripts,
    connect,
    disconnect,
    clearTranscripts,
    getFullTranscript,
  } = useRealtimeTranscribe();

  const [saving, setSaving] = useState(false);

  const toggle = useCallback(async () => {
    if (isConnected) {
      disconnect();
      try { navigator.vibrate?.(100); } catch {}
    } else {
      try { navigator.vibrate?.(50); } catch {}
      await connect();
    }
  }, [isConnected, connect, disconnect]);

  const handleSave = useCallback(async () => {
    const text = getFullTranscript();
    if (!text.trim()) {
      toast.error("Nothing to save");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("id, company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("No profile found");

      await (supabase as any).from("transcription_sessions").insert({
        profile_id: profile.id,
        company_id: profile.company_id,
        title: `Watch ${new Date().toLocaleString()}`,
        raw_transcript: text,
        process_type: "realtime",
        speaker_count: 1,
      });

      toast.success("Saved!");
      try { navigator.vibrate?.(200); } catch {}
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }, [getFullTranscript]);

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col select-none">
      {/* Top half: mic button */}
      <button
        onClick={toggle}
        disabled={isConnecting}
        className="flex-1 flex items-center justify-center active:bg-white/10 transition-colors"
      >
        <div className={`rounded-full p-8 ${isConnected ? "bg-red-600 animate-pulse" : "bg-white/20"}`}>
          {isConnecting ? (
            <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isConnected ? (
            <MicOff className="w-16 h-16" />
          ) : (
            <Mic className="w-16 h-16" />
          )}
        </div>
      </button>

      {/* Bottom half: transcript */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {committedTranscripts.map((t) => (
          <p key={t.id} className="text-lg font-medium leading-snug">{t.text}</p>
        ))}
        {partialText && (
          <p className="text-lg text-white/60 italic">
            {partialText}
            <span className="animate-pulse">▊</span>
          </p>
        )}
        {!isConnected && committedTranscripts.length === 0 && (
          <p className="text-center text-white/40 text-lg">Tap to start</p>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="flex gap-3 p-4 bg-white/5">
        <button
          onClick={handleSave}
          disabled={saving || committedTranscripts.length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-white/10 active:bg-white/20 disabled:opacity-30 text-sm font-medium"
        >
          <Save className="w-5 h-5" /> {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={clearTranscripts}
          disabled={committedTranscripts.length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-white/10 active:bg-white/20 disabled:opacity-30 text-sm font-medium"
        >
          <Trash2 className="w-5 h-5" /> Clear
        </button>
      </div>
    </div>
  );
}
