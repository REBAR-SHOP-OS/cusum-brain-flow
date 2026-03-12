import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Upload, Sparkles, FileText, Image as ImageIcon, Music, Mic, Loader2,
  Play, Palette, X, History, Trash2, FolderOpen
} from "lucide-react";
import { DEMO_SCRIPT, type BrandProfile, type ModelOverrides, DEFAULT_BRAND } from "@/types/adDirector";
import { VideoParameters, type VideoParams } from "./VideoParameters";
import { cn } from "@/lib/utils";
import { useAdProjectHistory, type AdProjectRow } from "@/hooks/useAdProjectHistory";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
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
    <div className="space-y-6">
      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Column: Creative Brief ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick Start Card */}
          {!script.trim() && (
            <button
              onClick={() => onScriptChange(DEMO_SCRIPT)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors shrink-0">
                <Play className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">Quick start — Load demo script</p>
                <p className="text-xs text-muted-foreground">See a 30s industrial ad example to understand the workflow</p>
              </div>
            </button>
          )}

          {/* Script Label + Demo toggle when script exists */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <Label className="text-base font-semibold">Creative Brief</Label>
            </div>
            {script.trim() && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onScriptChange("")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onScriptChange(DEMO_SCRIPT)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Load Demo
                </Button>
              </div>
            )}
          </div>

          {/* Script Textarea with counters */}
          <div className="relative rounded-xl bg-card/30 backdrop-blur-xl border border-white/[0.08] p-1">
            <Textarea
              value={script}
              onChange={(e) => onScriptChange(e.target.value)}
              placeholder="Paste your ad script here, or load the demo above to get started..."
              className="min-h-[280px] bg-transparent border-0 font-[Space_Grotesk] text-sm leading-relaxed pr-4 pb-10 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {script.trim() && (
              <div className="absolute bottom-3 left-3 flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground/70 bg-black/20 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/[0.08]">
                  {wordCount} words
                </span>
                <span className="text-[10px] text-muted-foreground/70 bg-black/20 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/[0.08]">
                  ~{estDuration}s
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: Brand Kit ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Brand Identity Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-4 space-y-3 ring-1 ring-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Palette className="w-4 h-4 text-primary" />
              <Label className="text-sm font-semibold">Brand Kit</Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Brand Name</Label>
                <Input
                  value={brand.name}
                  onChange={(e) => onBrandChange({ ...brand, name: e.target.value })}
                  className="h-8 text-xs bg-background/50"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Website</Label>
                <Input
                  value={brand.website}
                  onChange={(e) => onBrandChange({ ...brand, website: e.target.value })}
                  className="h-8 text-xs bg-background/50"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tagline</Label>
                <Input
                  value={brand.tagline}
                  onChange={(e) => onBrandChange({ ...brand, tagline: e.target.value })}
                  className="h-8 text-xs bg-background/50"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Audience</Label>
                <Input
                  value={brand.targetAudience}
                  onChange={(e) => onBrandChange({ ...brand, targetAudience: e.target.value })}
                  className="h-8 text-xs bg-background/50"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Call to Action</Label>
              <Input
                value={brand.cta}
                onChange={(e) => onBrandChange({ ...brand, cta: e.target.value })}
                className="h-8 text-xs bg-background/50"
              />
            </div>

            {/* Divider */}
            <div className="border-t border-border/20" />

            {/* Colors inline */}
            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brand.primaryColor}
                  onChange={(e) => onBrandChange({ ...brand, primaryColor: e.target.value })}
                  className="w-7 h-7 rounded-lg cursor-pointer border border-border/30"
                />
                <span className="text-[10px] text-muted-foreground">Primary</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brand.secondaryColor}
                  onChange={(e) => onBrandChange({ ...brand, secondaryColor: e.target.value })}
                  className="w-7 h-7 rounded-lg cursor-pointer border border-border/30"
                />
                <span className="text-[10px] text-muted-foreground">Secondary</span>
              </div>
            </div>

            {/* Brand Color Preview Strip */}
            {brand.name && (
              <div
                className="rounded-xl px-3 py-1.5 text-xs font-semibold text-center truncate"
                style={{ backgroundColor: brand.primaryColor, color: brand.secondaryColor }}
              >
                {brand.name} {brand.tagline ? `· ${brand.tagline}` : ""}
              </div>
            )}

            {/* Save Brand Kit Button */}
            {onSaveBrandKit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSaveBrandKit}
                disabled={savingBrandKit || !brand.name.trim()}
                className="w-full text-xs gap-1.5"
              >
                {savingBrandKit ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> Save Brand Kit</>
                )}
              </Button>
            )}
          </div>

          {/* Logo Upload Card */}
          <div className="rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm p-4 ring-1 ring-white/5">
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon className="w-4 h-4 text-primary" />
              <Label className="text-sm font-medium">Brand Logo</Label>
              <Badge variant="secondary" className="text-[9px] ml-auto">Mandatory Watermark</Badge>
            </div>
            {brand.logoUrl ? (
              <div className="flex items-center gap-3">
                <img src={brand.logoUrl} alt="Brand logo" className="h-10 rounded-lg border border-border/30" />
                <span className="text-xs text-muted-foreground flex-1 truncate">{brand.name} logo</span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onBrandChange({ ...brand, logoUrl: null })}>
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <>
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }} className="hidden" id="logo-upload" />
                <label htmlFor="logo-upload" className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border border-border/20 bg-background/30 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group",
                  uploadingLogo && "opacity-50 pointer-events-none"
                )}>
                  <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    {uploadingLogo ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">{uploadingLogo ? "Uploading…" : "Upload logo"}</p>
                    <p className="text-[10px] text-muted-foreground">Watermarked on every clip & final export</p>
                  </div>
                </label>
              </>
            )}
          </div>

          {/* Reference Assets Card */}
          <div className="rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm p-4 ring-1 ring-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Upload className="w-4 h-4 text-primary" />
              <Label className="text-sm font-medium">Reference Assets</Label>
              <Badge variant="outline" className="text-[9px] ml-auto">Optional</Badge>
            </div>
            <input type="file" multiple accept="image/*,video/*,audio/*,.pdf" onChange={handleFileUpload} className="hidden" id="asset-upload" />
            <label htmlFor="asset-upload" className="flex items-center gap-3 p-3 rounded-xl border border-border/20 bg-background/30 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group">
              <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <div className="flex gap-1">
                  <ImageIcon className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  <Music className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  <Mic className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Upload files</p>
                <p className="text-[10px] text-muted-foreground">Photos, drawings, voiceover, or music</p>
              </div>
            </label>
            {assets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {assets.map((f, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] gap-1 pr-1">
                    {f.name.length > 18 ? f.name.slice(0, 18) + "…" : f.name}
                    <button onClick={() => onAssetsChange(assets.filter((_, j) => j !== i))} className="ml-0.5 text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* AI Engine (collapsed) */}
          <AdvancedModelSettings
            modelOverrides={modelOverrides}
            onModelOverridesChange={onModelOverridesChange}
          />
        </div>
      </div>

      {/* Project History */}
      {projects.data && projects.data.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold">Recent Projects</Label>
            <Badge variant="outline" className="text-[9px]">{projects.data.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
            {projects.data.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 p-3 rounded-xl border border-border/30 bg-card/30 hover:border-primary/30 hover:bg-primary/5 transition-all group cursor-pointer"
                onClick={() => onLoadProject?.(p)}
              >
                <FolderOpen className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">{format(new Date(p.updated_at), "MMM d, HH:mm")}</span>
                    <Badge variant="outline" className={cn("text-[8px] h-4", p.status === "completed" ? "border-emerald-500/30 text-emerald-400" : "")}>
                      {p.status}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
      <div className="space-y-2">
        <Button
          onClick={onAnalyze}
          disabled={analyzing || !script.trim()}
          className="w-full h-14 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20 rounded-2xl"
          size="lg"
        >
          {analyzing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {analysisStatus || "Analyzing..."}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Analyze & Build Storyboard
            </>
          )}
        </Button>
        {!analyzing && (
          <p className="text-center text-[10px] text-muted-foreground/60">
            AI will segment, write prompts, and score quality · ~60s
          </p>
        )}
      </div>
    </div>
  );
}
