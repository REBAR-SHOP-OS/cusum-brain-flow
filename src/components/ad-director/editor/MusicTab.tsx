import { useState, useRef, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Music, Play, Pause, Loader2, Plus, Volume2, Check, Wand2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface MusicTrack {
  id: string;
  name: string;
  type: "Music" | "SFX" | "AI" | "Upload";
  duration: string;
  durationSec: number;
  url?: string;
  color: string;
}

const DURATION_OPTIONS = [
  { label: "15s", value: 15 },
  { label: "30s", value: 30 },
  { label: "60s", value: 60 },
];

const TYPE_OPTIONS = [
  { label: "🎵 Music", value: "music" as const },
  { label: "🔊 Sound Effect", value: "sfx" as const },
];

function getWaveformBars(id: string): number[] {
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed += id.charCodeAt(i);
  const bars: number[] = [];
  for (let i = 0; i < 28; i++) {
    seed = (seed * 16807 + 7) % 2147483647;
    bars.push(0.15 + (seed % 100) / 120);
  }
  return bars;
}

interface MusicTabProps {
  onTrackSelect?: (track: { url: string; name: string } | null) => void;
}

export function MusicTab({ onTrackSelect }: MusicTabProps) {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userTracks, setUserTracks] = useState<MusicTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState(0);
  const [volume, setVolume] = useState(80);
  const [generating, setGenerating] = useState(false);
  const [musicPrompt, setMusicPrompt] = useState("");
  const [duration, setDuration] = useState(30);
  const [genType, setGenType] = useState<"music" | "sfx">("music");
  const progressRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      if (audioRef.current && playing) {
        const pct = (audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100;
        setPlayProgress(pct);
        progressRef.current = requestAnimationFrame(tick);
      }
    };
    if (playing) {
      progressRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
    };
  }, [playing]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  const playTrack = async (track: MusicTrack) => {
    if (!track.url) {
      toast({ title: "No audio", description: "Generate or upload a track first" });
      return;
    }
    if (playing === track.id) {
      audioRef.current?.pause();
      setPlaying(null);
      setPlayProgress(0);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(track.url);
    audio.volume = volume / 100;
    audioRef.current = audio;
    audio.onended = () => { setPlaying(null); setPlayProgress(0); };
    audio.onerror = () => {
      setPlaying(null);
      setPlayProgress(0);
      toast({ title: "Playback failed", variant: "destructive" });
    };
    try {
      await audio.play();
      setPlaying(track.id);
    } catch {
      setPlaying(null);
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
          body: JSON.stringify({ prompt: musicPrompt, duration, type: genType === "sfx" ? "sfx" : undefined }),
        }
      );
      if (!response.ok) throw new Error(`Generation failed: ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const label = musicPrompt.slice(0, 30) || (genType === "sfx" ? "AI SFX" : "AI Music");
      const newTrack: MusicTrack = {
        id: `gen-${Date.now()}`,
        name: label,
        type: genType === "sfx" ? "SFX" : "AI",
        duration: genType === "sfx" ? `0:${String(duration).padStart(2, "0")}` : `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
        durationSec: duration,
        url,
        color: genType === "sfx" ? "from-orange-400 to-amber-500" : "from-primary to-primary/60",
      };
      setUserTracks(prev => [newTrack, ...prev]);
      setSelectedTrack(newTrack.id);
      onTrackSelect?.({ url, name: newTrack.name });
      setMusicPrompt("");
      toast({ title: genType === "sfx" ? "Sound effect generated" : "Music generated" });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const newTrack: MusicTrack = {
      id: `upload-${Date.now()}`,
      name: file.name.replace(/\.[^.]+$/, ""),
      type: "Upload",
      duration: "--",
      durationSec: 0,
      url,
      color: "from-muted-foreground/60 to-muted-foreground/30",
    };
    setUserTracks(prev => [newTrack, ...prev]);
    setSelectedTrack(newTrack.id);
    onTrackSelect?.({ url, name: newTrack.name });
    toast({ title: "Track uploaded", description: file.name });
    e.target.value = "";
  };

  const handleUseTrack = (track: MusicTrack) => {
    if (!track.url) return;
    setSelectedTrack(track.id);
    onTrackSelect?.({ url: track.url, name: track.name });
    toast({ title: "Track added", description: `"${track.name}" added to project` });
  };

  return (
    <div className="flex flex-col h-full">
      {/* AI Generator — always visible */}
      <div className="mx-1 mb-3 space-y-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">AI Music Generator</span>
        </div>

        <Textarea
          value={musicPrompt}
          onChange={e => setMusicPrompt(e.target.value)}
          placeholder="Describe your music... e.g. Upbeat corporate background, cinematic trailer..."
          className="min-h-[60px] text-xs resize-none"
          disabled={generating}
        />

        {/* Type chips */}
        <div className="flex gap-1.5">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setGenType(opt.value)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                genType === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Duration chips */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Duration:</span>
          {DURATION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDuration(opt.value)}
              className={cn(
                "px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors border",
                duration === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Button
          size="sm"
          className="w-full h-8 text-xs"
          onClick={handleGenerate}
          disabled={generating || !musicPrompt.trim()}
        >
          {generating ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Generating...</>
          ) : (
            <><Wand2 className="w-3.5 h-3.5 mr-1.5" /> Generate</>
          )}
        </Button>
      </div>

      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />

      {/* Tracks header */}
      <div className="flex items-center justify-between px-2 pb-2">
        <span className="text-xs font-semibold">Your Tracks</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3 h-3 text-muted-foreground" />
            <Slider value={[volume]} onValueChange={([v]) => setVolume(v)} max={100} step={1} className="w-14" />
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fileInputRef.current?.click()} title="Upload audio">
            <Upload className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 px-1">
        {userTracks.length === 0 && (
          <div className="rounded-lg border border-border/20 p-4 text-center text-xs text-muted-foreground">
            Generate music with AI or upload from your computer
          </div>
        )}
        {userTracks.map(track => {
          const bars = getWaveformBars(track.id);
          const isSelected = selectedTrack === track.id;
          const isPlaying = playing === track.id;

          return (
            <div
              key={track.id}
              className={cn(
                "relative rounded-lg transition-all cursor-pointer group overflow-hidden",
                isSelected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/30"
              )}
            >
              <div className="flex items-center gap-3 p-2.5">
                <div className={cn(
                  "w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm",
                  track.color
                )}>
                  <Music className="w-4 h-4 text-white" />
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">{track.name}</span>
                    {isSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{track.type}</div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); playTrack(track); }}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{track.duration}</span>

                    <div className="flex items-end gap-[1.5px] h-4 flex-1">
                      {bars.map((h, i) => {
                        const barPct = (i / bars.length) * 100;
                        const isPlayedBar = isPlaying && barPct <= playProgress;
                        return (
                          <div
                            key={i}
                            className={cn(
                              "w-[2px] rounded-full transition-all duration-150",
                              isPlaying
                                ? isPlayedBar ? "bg-primary" : "bg-primary/25"
                                : "bg-muted-foreground/30",
                              isPlaying && isPlayedBar && "animate-pulse"
                            )}
                            style={{ height: `${h * 100}%` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {track.url && (
                <button
                  onClick={e => { e.stopPropagation(); handleUseTrack(track); }}
                  className={cn(
                    "absolute right-2 top-2 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
                    "bg-primary text-primary-foreground shadow-sm",
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                >
                  Use
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
