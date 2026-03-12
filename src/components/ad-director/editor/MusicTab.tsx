import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Music, Upload, Sparkles, Play, Pause } from "lucide-react";

const MUSIC_TRACKS = [
  { id: "gen-1", name: "Generated Music", type: "AI", duration: "0:30" },
];

export function MusicTab() {
  const [selectedTrack, setSelectedTrack] = useState<string | null>("gen-1");
  const [playing, setPlaying] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Music Tracks</h4>

      {/* Track list */}
      <div className="space-y-2">
        {MUSIC_TRACKS.map(track => (
          <button
            key={track.id}
            onClick={() => setSelectedTrack(track.id)}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
              selectedTrack === track.id ? "border-primary bg-primary/5" : "border-border/30 hover:border-border/60"
            }`}
          >
            <button
              onClick={e => { e.stopPropagation(); setPlaying(playing === track.id ? null : track.id); }}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 flex-shrink-0"
            >
              {playing === track.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium">{track.name}</div>
              <div className="text-[10px] text-muted-foreground">{track.duration}</div>
            </div>
            <Badge variant="secondary" className="text-[9px]">{track.type}</Badge>
          </button>
        ))}
      </div>

      {/* Waveform placeholder */}
      <div className="h-12 rounded-lg bg-muted/30 border border-border/20 flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground">Waveform preview</span>
      </div>

      {/* Replace music */}
      <div className="space-y-2 pt-2 border-t border-border/30">
        <Label className="text-xs text-muted-foreground">Replace music</Label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 flex-1"><Upload className="w-3 h-3" /> Upload</Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 flex-1"><Music className="w-3 h-3" /> Stock</Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 flex-1"><Sparkles className="w-3 h-3" /> AI Generate</Button>
        </div>
      </div>
    </div>
  );
}
