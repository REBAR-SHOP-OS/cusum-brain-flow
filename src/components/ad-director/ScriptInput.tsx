import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Upload, Sparkles, FileText, Image as ImageIcon, Music, Loader2,
  Play, X, History, Trash2, FolderOpen, Wand2, ClipboardPaste, Clapperboard
} from "lucide-react";
import { DEMO_SCRIPT, type BrandProfile, type ModelOverrides } from "@/types/adDirector";
import { VideoParameters, type VideoParams } from "./VideoParameters";
import { cn } from "@/lib/utils";
import { useAdProjectHistory, type AdProjectRow } from "@/hooks/useAdProjectHistory";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

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
  return Math.round(words / 2.5);
}

export function ScriptInput({ script, brand, onScriptChange, onBrandChange, onAnalyze, analyzing, analysisStatus, assets, onAssetsChange, modelOverrides, onModelOverridesChange, onSaveBrandKit, savingBrandKit, onLoadProject, videoParams, onVideoParamsChange }: ScriptInputProps) {
  const { projects, deleteProject } = useAdProjectHistory();
  const { toast } = useToast();
  const [aiWriting, setAiWriting] = useState(false);
  const [productDescription, setProductDescription] = useState("");
  const [showAiWriter, setShowAiWriter] = useState(false);
  const [showTextarea, setShowTextarea] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onAssetsChange([...assets, ...Array.from(e.target.files)]);
    }
  };

  const handleAiWriteScript = async () => {
    if (!productDescription.trim()) return;
    setAiWriting(true);
    try {
      const res = await invokeEdgeFunction<{ result: { text: string }; modelUsed: string }>(
        "ad-director-ai",
        {
          action: "write-script",
          input: productDescription,
          brand,
        },
        { timeoutMs: 60_000 }
      );
      onScriptChange(res.result.text);
      setShowAiWriter(false);
      setProductDescription("");
      toast({ title: "Script generated", description: `Written by ${res.modelUsed}` });
    } catch (err: any) {
      toast({ title: "Script generation failed", description: err.message, variant: "destructive" });
    } finally {
      setAiWriting(false);
    }
  };

  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const estDuration = estimateDuration(script);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left Column: Creative Brief ── */}
        <div className="lg:col-span-2 space-y-3">
          {/* Empty State — Quick-Start Options */}
          {!script.trim() && !showAiWriter && !showTextarea && (
            <div className="rounded-xl border border-border/30 bg-card/30 p-6 space-y-4">
              <div className="text-center space-y-1">
                <Clapperboard className="w-8 h-8 text-primary mx-auto mb-2" />
                <h3 className="text-base font-semibold text-foreground">Create your video ad</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Start with a script and the AI will break it into scenes, write cinematic prompts, and generate video clips.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => setShowTextarea(true)}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                >
                  <ClipboardPaste className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                  <span className="text-xs font-medium">Paste a script</span>
                  <span className="text-[10px] text-muted-foreground">Already have copy? Paste it in</span>
                </button>
                <button
                  onClick={() => onScriptChange(DEMO_SCRIPT)}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                >
                  <Play className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                  <span className="text-xs font-medium">Demo script</span>
                  <span className="text-[10px] text-muted-foreground">30s industrial ad example</span>
                </button>
                <button
                  onClick={() => setShowAiWriter(true)}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10 transition-all group"
                >
                  <Wand2 className="w-5 h-5 text-primary" />
                  <span className="text-xs font-medium text-primary">AI writes it</span>
                  <span className="text-[10px] text-muted-foreground">Describe your product</span>
                </button>
              </div>
            </div>
          )}

          {/* AI Script Writer Panel */}
          {showAiWriter && !script.trim() && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-primary" />
                  AI Script Writer
                </Label>
                <Button variant="ghost" size="sm" onClick={() => setShowAiWriter(false)} className="h-7 text-xs">Cancel</Button>
              </div>
              <Textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Describe your product/service in 1-2 sentences... e.g. 'We provide fast rebar shop drawings for construction contractors. Upload drawings, get detailing in 48 hours.'"
                className="min-h-[80px] text-sm bg-background/50"
              />
              <Button
                onClick={handleAiWriteScript}
                disabled={aiWriting || !productDescription.trim()}
                size="sm"
                className="gap-2"
              >
                {aiWriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {aiWriting ? "Writing..." : "Generate 30s Script"}
              </Button>
            </div>
          )}

          {/* Existing textarea — show when script has content OR user clicked "Paste a script" */}
          {(script.trim().length > 0 || showTextarea) && (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Creative Brief
                </Label>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { onScriptChange(""); setShowTextarea(false); }} className="text-[11px] h-7 text-muted-foreground">Clear</Button>
                  <Button variant="ghost" size="sm" onClick={() => onScriptChange(DEMO_SCRIPT)} className="text-[11px] h-7 text-muted-foreground">Demo</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAiWriter(true)} className="text-[11px] h-7 text-primary gap-1">
                    <Wand2 className="w-3 h-3" />AI Write
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Textarea
                  id="script-textarea"
                  value={script}
                  onChange={(e) => onScriptChange(e.target.value)}
                  placeholder="Paste your ad script here..."
                  className="min-h-[260px] text-sm leading-relaxed pb-10 rounded-lg border-border/30 bg-card/20"
                  autoFocus={showTextarea && !script.trim()}
                />
                {script.trim() && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/60 bg-muted/40 px-2 py-0.5 rounded">{wordCount} words</span>
                    <span className="text-[10px] text-muted-foreground/60 bg-muted/40 px-2 py-0.5 rounded">~{estDuration}s</span>
                  </div>
                )}
              </div>
            </>
          )}
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
