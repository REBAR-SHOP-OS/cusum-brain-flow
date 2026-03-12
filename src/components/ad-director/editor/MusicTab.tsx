import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Music, Upload, Sparkles, Play, Pause, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MusicTrack {
  id: string;
  name: string;
  type: string;
  duration: string;
  url?: string;
}

interface MusicTabProps {
  onTrackSelect?: (track: { url: string; name: string } | null) => void;
}

export function MusicTab({ onTrackSelect }: MusicTabProps) {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [musicPrompt, setMusicPrompt] = useState("");

  const playTrack = async (track: MusicTrack) => {
    if (!track.url) return;
    if (playing === track.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(track.url);
    audioRef.current = audio;
    audio.onended = () => setPlaying(null);
    audio.onerror = () => {
      setPlaying(null);
      toast({ title: "Playback failed", description: "Could not play this track", variant: "destructive" });
    };
    try {
      await audio.play();
      setPlaying(track.id);
    } catch {
      setPlaying(null);
      toast({ title: "Playback failed", description: "Browser blocked audio playback", variant: "destructive" });
    }
  };

  const handleGenerate = async () => {
    if (!musicPrompt.trim()) return;
    setGenerating(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ prompt: musicPrompt, duration: 30 }),
        }
      );
      if (!response.ok) throw new Error(`Music generation failed: ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const newTrack: MusicTrack = {
        id: `gen-${Date.now()}`,
        name: musicPrompt.slice(0, 30) || "AI Music",
        type: "AI",
        duration: "0:30",
        url,
      };
      setTracks(prev => [newTrack, ...prev]);
      setSelectedTrack(newTrack.id);
      setShowPromptInput(false);
      setMusicPrompt("");
      toast({ title: "Music generated", description: "AI track ready to preview" });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleUpload = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const newTrack: MusicTrack = {
      id: `upload-${Date.now()}`,
      name: file.name,
      type: "Upload",
      duration: "--",
      url,
    };
    setTracks(prev => [newTrack, ...prev]);
    setSelectedTrack(newTrack.id);
    toast({ title: "Track uploaded", description: file.name });
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Music Tracks</h4>
      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />

      {/* AI Generate prompt */}
      {showPromptInput && (
        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <Label className="text-xs">Describe the music you want</Label>
          <Input
            value={musicPrompt}
            onChange={e => setMusicPrompt(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleGenerate()}
            placeholder="e.g. Upbeat corporate background music, inspiring..."
            className="h-8 text-xs"
            disabled={generating}
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleGenerate} disabled={generating || !musicPrompt.trim()}>
              {generating ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Generating...</> : "Generate"}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowPromptInput(false)} disabled={generating}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Track list */}
      <div className="space-y-2">
        {tracks.length === 0 && (
          <div className="rounded-lg border border-border/20 p-4 text-center text-xs text-muted-foreground">
            No tracks yet. Upload or generate music below.
          </div>
        )}
        {tracks.map(track => (
          <div
            key={track.id}
            onClick={() => setSelectedTrack(track.id)}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left cursor-pointer ${
              selectedTrack === track.id ? "border-primary bg-primary/5" : "border-border/30 hover:border-border/60"
            }`}
          >
            <button
              onClick={e => { e.stopPropagation(); playTrack(track); }}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 flex-shrink-0"
            >
              {playing === track.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{track.name}</div>
              <div className="text-[10px] text-muted-foreground">{track.duration}</div>
            </div>
            <Badge variant="secondary" className="text-[9px]">{track.type}</Badge>
          </div>
        ))}
      </div>

      {/* Waveform placeholder */}
      {selectedTrack && (
        <div className="h-12 rounded-lg bg-muted/30 border border-border/20 flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground">Waveform preview</span>
        </div>
      )}

      {/* Replace music */}
      <div className="space-y-2 pt-2 border-t border-border/30">
        <Label className="text-xs text-muted-foreground">Add music</Label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 flex-1" onClick={handleUpload}>
            <Upload className="w-3 h-3" /> Upload
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1 flex-1"
            onClick={() => toast({ title: "Coming soon", description: "Stock music library is under development" })}
          >
            <Music className="w-3 h-3" /> Stock
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 flex-1" onClick={() => setShowPromptInput(true)} disabled={generating}>
            <Sparkles className="w-3 h-3" /> AI Generate
          </Button>
        </div>
      </div>
    </div>
  );
}
