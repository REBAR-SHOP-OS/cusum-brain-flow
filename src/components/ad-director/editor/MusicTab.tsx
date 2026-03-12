import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Music, Upload, Sparkles, Play, Pause, Loader2, Search, ChevronDown, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface MusicTrack {
  id: string;
  name: string;
  type: "Music" | "SFX" | "AI" | "Upload";
  duration: string;
  url?: string;
  color: string;
}

// Preset stock tracks – cosmetic, no real URLs until user generates/uploads
const STOCK_TRACKS: MusicTrack[] = [
  { id: "stock-1", name: "Glitter", type: "Music", duration: "02:41", color: "from-yellow-400 to-amber-500" },
  { id: "stock-2", name: "All night", type: "Music", duration: "02:08", color: "from-emerald-400 to-teal-500" },
  { id: "stock-3", name: "Side hustle", type: "Music", duration: "02:27", color: "from-violet-400 to-purple-500" },
  { id: "stock-4", name: "Fresh wind", type: "Music", duration: "02:57", color: "from-pink-400 to-rose-500" },
  { id: "stock-5", name: "Get this", type: "Music", duration: "02:25", color: "from-orange-400 to-red-500" },
  { id: "stock-6", name: "Thinking the same", type: "Music", duration: "02:49", color: "from-cyan-400 to-blue-500" },
  { id: "stock-7", name: "Kicked in", type: "Music", duration: "02:33", color: "from-fuchsia-400 to-pink-500" },
  { id: "stock-8", name: "Full throttle", type: "Music", duration: "03:12", color: "from-lime-400 to-green-500" },
  { id: "stock-9", name: "Neon drive", type: "Music", duration: "02:55", color: "from-indigo-400 to-violet-500" },
  { id: "stock-10", name: "Momentum", type: "Music", duration: "03:01", color: "from-amber-400 to-yellow-500" },
  { id: "stock-11", name: "Blueprint", type: "Music", duration: "02:18", color: "from-sky-400 to-cyan-500" },
  { id: "stock-12", name: "Power surge", type: "Music", duration: "02:44", color: "from-red-400 to-orange-500" },
];

const AUDIO_FILTERS = ["All audio", "Music", "Sound effects"] as const;
type AudioFilter = (typeof AUDIO_FILTERS)[number];

// Pseudo-random waveform bars per track (deterministic)
function getWaveformBars(id: string): number[] {
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed += id.charCodeAt(i);
  const bars: number[] = [];
  for (let i = 0; i < 24; i++) {
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
  const [generating, setGenerating] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [musicPrompt, setMusicPrompt] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AudioFilter>("All audio");
  const [filterOpen, setFilterOpen] = useState(false);

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

  const playTrack = async (track: MusicTrack) => {
    if (!track.url) {
      toast({ title: "Stock preview", description: "Generate or upload a track to play it" });
      return;
    }
    if (playing === track.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
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
      url,
      color: "from-muted-foreground/60 to-muted-foreground/30",
    };
    setUserTracks(prev => [newTrack, ...prev]);
    setSelectedTrack(newTrack.id);
    onTrackSelect?.({ url, name: newTrack.name });
    toast({ title: "Track uploaded", description: file.name });
    e.target.value = "";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-3">
        <h4 className="text-sm font-semibold">Music</h4>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPromptInput(v => !v)}>
            <Sparkles className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fileInputRef.current?.click()}>
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

      {/* Count */}
      <div className="px-2 pb-2">
        <span className="text-[11px] text-muted-foreground">{filteredTracks.length} items</span>
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
      <div className="flex-1 overflow-y-auto space-y-1 px-1">
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
              onClick={() => {
                setSelectedTrack(track.id);
                if (track.url) onTrackSelect?.({ url: track.url, name: track.name });
              }}
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg transition-all cursor-pointer group",
                isSelected
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted/30 border border-transparent"
              )}
            >
              {/* Colorful circle icon */}
              <div className={cn(
                "w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0",
                track.color
              )}>
                <Music className="w-4 h-4 text-white" />
              </div>

              {/* Info + waveform */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate">{track.name}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">{track.type}</div>

                {/* Waveform + play + duration row */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); playTrack(track); }}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </button>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{track.duration}</span>

                  {/* Mini waveform bars */}
                  <div className="flex items-end gap-[1px] h-3 flex-1">
                    {bars.map((h, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-[2px] rounded-full transition-colors",
                          isPlaying ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                        style={{ height: `${h * 100}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
