import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Upload, Sparkles, FileText, Image as ImageIcon, Music, Mic, Loader2,
  Play, X, History, Trash2, FolderOpen
} from "lucide-react";
import { DEMO_SCRIPT, type BrandProfile, type ModelOverrides } from "@/types/adDirector";
import { VideoParameters, type VideoParams } from "./VideoParameters";
import { cn } from "@/lib/utils";
import { useAdProjectHistory, type AdProjectRow } from "@/hooks/useAdProjectHistory";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ScriptInputProps {
  script: string;
  brand: BrandProfile;
  onScriptChange: (s: string) => void;
  onBrandChange: (b: BrandProfile) => void;
  onAnalyze: () => void;
  analyzing: boolean;
  analysisStatus?: string;
  assets: File[];
  onAssetsChange: (files: File[]) => void;
  modelOverrides: ModelOverrides;
  onModelOverridesChange: (overrides: ModelOverrides) => void;
  onSaveBrandKit?: () => void;
  savingBrandKit?: boolean;
  onLoadProject?: (project: AdProjectRow) => void;
  videoParams: VideoParams;
  onVideoParamsChange: (p: VideoParams) => void;
}

function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words / 2.5); // ~150 wpm = 2.5 words/sec
}

export function ScriptInput({ script, brand, onScriptChange, onBrandChange, onAnalyze, analyzing, analysisStatus, assets, onAssetsChange, modelOverrides, onModelOverridesChange, onSaveBrandKit, savingBrandKit, onLoadProject, videoParams, onVideoParamsChange }: ScriptInputProps) {
  const { projects, deleteProject } = useAdProjectHistory();
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onAssetsChange([...assets, ...Array.from(e.target.files)]);
    }
  };

  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const estDuration = estimateDuration(script);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left Column: Creative Brief ── */}
        <div className="lg:col-span-2 space-y-3">
          {/* Quick Start */}
          {!script.trim() && (
            <button
              onClick={() => onScriptChange(DEMO_SCRIPT)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all group"
            >
              <Play className="w-4 h-4 text-primary shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">Load demo script</p>
                <p className="text-[11px] text-muted-foreground">30s industrial ad example</p>
              </div>
            </button>
          )}

          {/* Label */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              Creative Brief
            </Label>
            {script.trim() && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => onScriptChange("")} className="text-[11px] h-7 text-muted-foreground">Clear</Button>
                <Button variant="ghost" size="sm" onClick={() => onScriptChange(DEMO_SCRIPT)} className="text-[11px] h-7 text-muted-foreground">Demo</Button>
              </div>
            )}
          </div>

          {/* Textarea */}
          <div className="relative">
            <Textarea
              value={script}
              onChange={(e) => onScriptChange(e.target.value)}
              placeholder="Paste your ad script here, or load the demo above..."
              className="min-h-[260px] text-sm leading-relaxed pb-10 rounded-lg border-border/30 bg-card/20"
            />
            {script.trim() && (
              <div className="absolute bottom-2 left-2 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/60 bg-muted/40 px-2 py-0.5 rounded">{wordCount} words</span>
                <span className="text-[10px] text-muted-foreground/60 bg-muted/40 px-2 py-0.5 rounded">~{estDuration}s</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: Assets & Video Params ── */}
        <div className="space-y-3">
          {/* Reference Assets */}
          <div className="rounded-lg border border-border/20 bg-card/20 p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <Upload className="w-3.5 h-3.5 text-primary" />
              <Label className="text-xs font-medium">Reference Assets</Label>
              <span className="text-[9px] text-muted-foreground/50 ml-auto">Optional</span>
            </div>
            <input type="file" multiple accept="image/*,video/*,audio/*,.pdf" onChange={handleFileUpload} className="hidden" id="asset-upload" />
            <label htmlFor="asset-upload" className="flex items-center gap-2.5 p-2.5 rounded-md border border-dashed border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group">
              <div className="flex gap-1 text-muted-foreground group-hover:text-primary">
                <ImageIcon className="w-3.5 h-3.5" />
                <Music className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] text-muted-foreground group-hover:text-foreground">Upload photos, audio, or docs</span>
            </label>
            {assets.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {assets.map((f, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] gap-1 pr-1">
                    {f.name.length > 16 ? f.name.slice(0, 16) + "…" : f.name}
                    <button onClick={() => onAssetsChange(assets.filter((_, j) => j !== i))} className="ml-0.5 text-muted-foreground hover:text-foreground">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <VideoParameters params={videoParams} onChange={onVideoParamsChange} />
        </div>
      </div>

      {/* Project History */}
      {projects.data && projects.data.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-primary" />
            Recent Projects
            <span className="text-[9px] text-muted-foreground ml-1">({projects.data.length})</span>
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-[160px] overflow-y-auto">
            {projects.data.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border/20 hover:border-primary/20 hover:bg-primary/5 transition-all group cursor-pointer"
                onClick={() => onLoadProject?.(p)}
              >
                <FolderOpen className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">{p.name}</p>
                  <span className="text-[9px] text-muted-foreground">{format(new Date(p.updated_at), "MMM d, HH:mm")}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); deleteProject.mutate(p.id); }}
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary CTA */}
      <Button
        onClick={onAnalyze}
        disabled={analyzing || !script.trim()}
        className="w-full h-12 text-sm font-semibold rounded-lg"
        size="lg"
      >
        {analyzing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {analysisStatus || "Analyzing..."}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Analyze & Build Storyboard
          </>
        )}
      </Button>
    </div>
  );
}
