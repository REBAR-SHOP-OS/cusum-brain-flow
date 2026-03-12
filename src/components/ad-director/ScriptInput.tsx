import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Sparkles, FileText, Image as ImageIcon, Music, Mic, Loader2 } from "lucide-react";
import { DEMO_SCRIPT, type BrandProfile, DEFAULT_BRAND } from "@/types/adDirector";
import { cn } from "@/lib/utils";

interface ScriptInputProps {
  script: string;
  brand: BrandProfile;
  onScriptChange: (s: string) => void;
  onBrandChange: (b: BrandProfile) => void;
  onAnalyze: () => void;
  analyzing: boolean;
  assets: File[];
  onAssetsChange: (files: File[]) => void;
}

export function ScriptInput({ script, brand, onScriptChange, onBrandChange, onAnalyze, analyzing, assets, onAssetsChange }: ScriptInputProps) {
  const [showBrand, setShowBrand] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onAssetsChange([...assets, ...Array.from(e.target.files)]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Script Area */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <Label className="text-base font-semibold">Ad Script</Label>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onScriptChange(DEMO_SCRIPT)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Load Demo Script
          </Button>
        </div>
        <Textarea
          value={script}
          onChange={(e) => onScriptChange(e.target.value)}
          placeholder="Paste your 30-second ad script here..."
          className="min-h-[240px] bg-card/50 border-border/50 font-mono text-sm leading-relaxed"
        />
      </div>

      {/* Brand Settings Toggle */}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowBrand(!showBrand)}
          className="text-xs"
        >
          {showBrand ? "Hide" : "Show"} Brand Settings
        </Button>
        {showBrand && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              { key: "name", label: "Brand Name" },
              { key: "website", label: "Website" },
              { key: "tagline", label: "Tagline" },
              { key: "targetAudience", label: "Target Audience" },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={(brand as any)[key]}
                  onChange={(e) => onBrandChange({ ...brand, [key]: e.target.value })}
                  className="h-8 text-xs bg-card/50"
                />
              </div>
            ))}
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">CTA</Label>
              <Input
                value={brand.cta}
                onChange={(e) => onBrandChange({ ...brand, cta: e.target.value })}
                className="h-8 text-xs bg-card/50"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Primary Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={brand.primaryColor}
                  onChange={(e) => onBrandChange({ ...brand, primaryColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <span className="text-xs text-muted-foreground">{brand.primaryColor}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Secondary Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={brand.secondaryColor}
                  onChange={(e) => onBrandChange({ ...brand, secondaryColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <span className="text-xs text-muted-foreground">{brand.secondaryColor}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Asset Upload */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          <Label className="text-sm font-medium">Reference Assets</Label>
          <Badge variant="outline" className="text-[10px]">Optional</Badge>
        </div>
        <div className="border border-dashed border-border/50 rounded-xl p-4 text-center hover:border-primary/40 transition-colors">
          <input
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.pdf"
            onChange={handleFileUpload}
            className="hidden"
            id="asset-upload"
          />
          <label htmlFor="asset-upload" className="cursor-pointer space-y-2">
            <div className="flex justify-center gap-3 text-muted-foreground">
              <ImageIcon className="w-5 h-5" />
              <Music className="w-5 h-5" />
              <Mic className="w-5 h-5" />
            </div>
            <p className="text-xs text-muted-foreground">
              Upload logos, product images, site photos, shop drawings, voiceover, or music
            </p>
          </label>
        </div>
        {assets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {assets.map((f, i) => (
              <Badge key={i} variant="secondary" className="text-xs gap-1">
                {f.name.length > 20 ? f.name.slice(0, 20) + "…" : f.name}
                <button onClick={() => onAssetsChange(assets.filter((_, j) => j !== i))} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Analyze Button */}
      <Button
        onClick={onAnalyze}
        disabled={analyzing || !script.trim()}
        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
        size="lg"
      >
        {analyzing ? (
          <>
            <Sparkles className="w-5 h-5 mr-2 animate-pulse" />
            Analyzing Script...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            Analyze & Create Storyboard
          </>
        )}
      </Button>
    </div>
  );
}
