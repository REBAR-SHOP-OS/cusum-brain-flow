import { useState, useRef, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Music, Sparkles, Play, Pause, Loader2, Search, ChevronDown, Plus, Volume2, Check } from "lucide-react";
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

const STOCK_TRACKS: MusicTrack[] = [
  { id: "stock-1", name: "Glitter", type: "Music", duration: "02:41", durationSec: 161, color: "from-yellow-400 to-amber-500" },
  { id: "stock-2", name: "All night", type: "Music", duration: "02:08", durationSec: 128, color: "from-emerald-400 to-teal-500" },
  { id: "stock-3", name: "Side hustle", type: "Music", duration: "02:27", durationSec: 147, color: "from-violet-400 to-purple-500" },
  { id: "stock-4", name: "Fresh wind", type: "Music", duration: "02:57", durationSec: 177, color: "from-pink-400 to-rose-500" },
  { id: "stock-5", name: "Get this", type: "Music", duration: "02:25", durationSec: 145, color: "from-orange-400 to-red-500" },
  { id: "stock-6", name: "Thinking the same", type: "Music", duration: "02:49", durationSec: 169, color: "from-cyan-400 to-blue-500" },
  { id: "stock-7", name: "Kicked in", type: "Music", duration: "02:33", durationSec: 153, color: "from-fuchsia-400 to-pink-500" },
  { id: "stock-8", name: "Full throttle", type: "Music", duration: "03:12", durationSec: 192, color: "from-lime-400 to-green-500" },
  { id: "stock-9", name: "Neon drive", type: "Music", duration: "02:55", durationSec: 175, color: "from-indigo-400 to-violet-500" },
  { id: "stock-10", name: "Momentum", type: "Music", duration: "03:01", durationSec: 181, color: "from-amber-400 to-yellow-500" },
  { id: "stock-11", name: "Blueprint", type: "Music", duration: "02:18", durationSec: 138, color: "from-sky-400 to-cyan-500" },
  { id: "stock-12", name: "Power surge", type: "Music", duration: "02:44", durationSec: 164, color: "from-red-400 to-orange-500" },
];

const AUDIO_FILTERS = ["All audio", "Music", "Sound effects"] as const;
type AudioFilter = (typeof AUDIO_FILTERS)[number];

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
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [musicPrompt, setMusicPrompt] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AudioFilter>("All audio");
  const [filterOpen, setFilterOpen] = useState(false);
  const progressRef = useRef<number | null>(null);

  const allTracks = useMemo(() => [...userTracks, ...STOCK_TRACKS], [userTracks]);

  const filteredTracks = useMemo(() => {
    let list = allTracks;
    if (filter === "Music") list = list.filter(t => t.type === "Music" || t.type === "AI");
    if (filter === "Sound effects") list = list.filter(t => t.type === "SFX");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [allTracks, filter, search]);

  // Update progress during playback
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

  // Apply volume changes
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  const playTrack = async (track: MusicTrack) => {
    if (!track.url) {
      toast({ title: "Stock preview", description: "Generate or upload a track to play it" });
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
        durationSec: 30,
        url,
        color: "from-primary to-primary/60",
      };
      setUserTracks(prev => [newTrack, ...prev]);
      setSelectedTrack(newTrack.id);
      onTrackSelect?.({ url, name: newTrack.name });
      setShowPromptInput(false);
      setMusicPrompt("");
      toast({ title: "Music generated", description: "AI track ready to preview" });
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
    if (!track.url) {
      toast({ title: "No audio", description: "Generate or upload a track first" });
      return;
    }
    setSelectedTrack(track.id);
    onTrackSelect?.({ url: track.url, name: track.name });
    toast({ title: "Track added", description: `"${track.name}" added to project` });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-3">
        <h4 className="text-sm font-semibold">Music</h4>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPromptInput(v => !v)} title="AI Generate">
            <Sparkles className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fileInputRef.current?.click()} title="Upload audio">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />

      {/* Filter chip */}
      <div className="pb-2 px-1 relative">
        <button
          onClick={() => setFilterOpen(v => !v)}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground"
        >
          {filter}
          <ChevronDown className="w-3 h-3" />
        </button>
        {filterOpen && (
          <div className="absolute z-20 top-8 left-1 rounded-lg border border-border bg-popover shadow-lg py-1 min-w-[140px]">
            {AUDIO_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => { setFilter(f); setFilterOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors",
                  filter === f && "text-primary font-medium"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative px-1 pb-2">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search audio"
          className="h-8 text-xs pl-8 bg-muted/30 border-border/30"
        />
      </div>

      {/* Count + Volume */}
      <div className="flex items-center justify-between px-2 pb-2">
        <span className="text-[11px] text-muted-foreground">{filteredTracks.length} items</span>
        <div className="flex items-center gap-1.5">
          <Volume2 className="w-3 h-3 text-muted-foreground" />
          <Slider
            value={[volume]}
            onValueChange={([v]) => setVolume(v)}
            max={100}
            step={1}
            className="w-16"
          />
        </div>
      </div>

      {/* AI Generate prompt */}
      {showPromptInput && (
        <div className="mx-1 mb-2 space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <Label className="text-xs">Describe the music you want</Label>
          <Input
            value={musicPrompt}
            onChange={e => setMusicPrompt(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleGenerate()}
            placeholder="e.g. Upbeat corporate background music..."
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
      <div className="flex-1 overflow-y-auto space-y-1.5 px-1">
        {filteredTracks.length === 0 && (
          <div className="rounded-lg border border-border/20 p-4 text-center text-xs text-muted-foreground">
            No tracks found
          </div>
        )}
        {filteredTracks.map(track => {
          const bars = getWaveformBars(track.id);
          const isSelected = selectedTrack === track.id;
          const isPlaying = playing === track.id;

          return (
            <div
              key={track.id}
              className={cn(
                "relative rounded-lg transition-all cursor-pointer group overflow-hidden",
                isSelected
                  ? "bg-primary/10 ring-1 ring-primary/30"
                  : "hover:bg-muted/30"
              )}
            >
              <div className="flex items-center gap-3 p-2.5">
                {/* Colorful circle icon */}
                <div className={cn(
                  "w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm",
                  track.color
                )}>
                  <Music className="w-4 h-4 text-white" />
                </div>

                {/* Info + waveform */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">{track.name}</span>
                    {isSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{track.type}</div>

                  {/* Waveform + play + duration row */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); playTrack(track); }}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{track.duration}</span>

                    {/* Mini waveform bars */}
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
                                ? isPlayedBar
                                  ? "bg-primary"
                                  : "bg-primary/25"
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

              {/* Hover action — "Add to project" */}
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
