import { useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check } from "lucide-react";
import type { IntroOutroCardSettings, BrandProfile } from "@/types/adDirector";

const FONT_OPTIONS = [
  { value: "sans-serif", label: "Sans Serif" },
  { value: "'Space Grotesk', sans-serif", label: "Space Grotesk" },
  { value: "'Inter', sans-serif", label: "Inter" },
  { value: "serif", label: "Serif" },
  { value: "'Georgia', serif", label: "Georgia" },
  { value: "monospace", label: "Monospace" },
];

const LAYOUT_PRESETS: { value: IntroOutroCardSettings["layout"]; label: string }[] = [
  { value: "centered", label: "Centered Stack" },
  { value: "left", label: "Left Aligned" },
  { value: "logo-top", label: "Logo Top" },
  { value: "minimal", label: "Minimal" },
  { value: "split", label: "Split (Logo | Text)" },
];

interface IntroOutroEditorProps {
  settings: IntroOutroCardSettings;
  brand: BrandProfile;
  onChange: (s: IntroOutroCardSettings) => void;
  onApply: () => void;
}

/** Draws a card preview onto a canvas element using the given settings + optional logo */
export function drawCardToCanvas(
  canvas: HTMLCanvasElement,
  settings: IntroOutroCardSettings,
  logoImg: HTMLImageElement | null,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, settings.gradientStart);
  grad.addColorStop(1, settings.gradientEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const isLeft = settings.layout === "left";
  const isLogoTop = settings.layout === "logo-top";
  const isMinimal = settings.layout === "minimal";
  ctx.textAlign = isLeft ? "left" : "center";
  const xAnchor = isLeft ? 80 : W / 2;

  let yOffset = H / 2 - 60;

  // Logo
  if (settings.showLogo && logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    const logoH = 60 * settings.logoScale;
    const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
    let logoX = xAnchor - (isLeft ? 0 : logoW / 2);
    let logoY = yOffset - logoH - 20;
    if (isLogoTop || settings.logoPosition === "top") {
      logoY = 60;
      logoX = W / 2 - logoW / 2;
    } else if (settings.logoPosition === "bottom") {
      logoY = H - logoH - 40;
      logoX = W / 2 - logoW / 2;
    } else if (settings.logoPosition === "center") {
      logoY = H / 2 - logoH / 2 - 80;
      logoX = W / 2 - logoW / 2;
    }
    ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
    if (isLogoTop) yOffset = logoY + logoH + 60;
  }

  // Headline
  ctx.fillStyle = settings.textColor;
  ctx.font = `bold ${settings.headlineFontSize}px ${settings.fontFamily}`;
  ctx.fillText(settings.headline, xAnchor, yOffset);

  // Subheadline
  if (settings.subheadline && !isMinimal) {
    ctx.font = `${settings.subFontSize}px ${settings.fontFamily}`;
    ctx.fillStyle = settings.textColor + "d9"; // ~85% opacity
    ctx.fillText(settings.subheadline, xAnchor, yOffset + 60);
  }

  // CTA
  if (settings.cta && !isMinimal) {
    ctx.font = `${Math.round(settings.subFontSize * 0.75)}px ${settings.fontFamily}`;
    ctx.fillStyle = settings.textColor + "b3"; // ~70% opacity
    ctx.fillText(settings.cta, xAnchor, yOffset + 110);
  }

  // Website
  if (settings.website) {
    ctx.font = `bold ${Math.round(settings.subFontSize * 0.88)}px ${settings.fontFamily}`;
    ctx.fillStyle = settings.textColor;
    ctx.fillText(settings.website, xAnchor, yOffset + (isMinimal ? 60 : 160));
  }
}

export function IntroOutroEditor({ settings, brand, onChange, onApply }: IntroOutroEditorProps) {
  const update = useCallback(
    <K extends keyof IntroOutroCardSettings>(key: K, val: IntroOutroCardSettings[K]) =>
      onChange({ ...settings, [key]: val }),
    [settings, onChange],
  );

  return (
    <div className="space-y-4 p-1 text-sm">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Card Editor</h4>

      {/* Layout presets */}
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Layout</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {LAYOUT_PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => update("layout", p.value)}
              className={`text-[10px] rounded-md border px-2 py-1.5 transition-colors ${
                settings.layout === p.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-border"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Text fields */}
      <div className="space-y-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Headline</Label>
        <Input value={settings.headline} onChange={e => update("headline", e.target.value)} className="h-8 text-xs" />
      </div>
      <div className="space-y-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Subheadline</Label>
        <Input value={settings.subheadline} onChange={e => update("subheadline", e.target.value)} className="h-8 text-xs" />
      </div>
      <div className="space-y-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">CTA</Label>
        <Input value={settings.cta} onChange={e => update("cta", e.target.value)} className="h-8 text-xs" />
      </div>
      <div className="space-y-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Website</Label>
        <Input value={settings.website} onChange={e => update("website", e.target.value)} className="h-8 text-xs" />
      </div>

      {/* Font */}
      <div className="space-y-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Font</Label>
        <Select value={settings.fontFamily} onValueChange={v => update("fontFamily", v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map(f => (
              <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Font sizes */}
      <div className="space-y-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Headline Size: {settings.headlineFontSize}px</Label>
        <Slider min={24} max={96} step={2} value={[settings.headlineFontSize]} onValueChange={([v]) => update("headlineFontSize", v)} />
      </div>
      <div className="space-y-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Sub Size: {settings.subFontSize}px</Label>
        <Slider min={16} max={64} step={2} value={[settings.subFontSize]} onValueChange={([v]) => update("subFontSize", v)} />
      </div>

      {/* Colors */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Grad Start</Label>
          <input type="color" value={settings.gradientStart} onChange={e => update("gradientStart", e.target.value)} className="w-full h-7 rounded cursor-pointer border border-border/40" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Grad End</Label>
          <input type="color" value={settings.gradientEnd} onChange={e => update("gradientEnd", e.target.value)} className="w-full h-7 rounded cursor-pointer border border-border/40" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Text</Label>
          <input type="color" value={settings.textColor} onChange={e => update("textColor", e.target.value)} className="w-full h-7 rounded cursor-pointer border border-border/40" />
        </div>
      </div>

      {/* Logo controls */}
      <div className="space-y-2 pt-2 border-t border-border/30">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Show Logo</Label>
          <Switch checked={settings.showLogo} onCheckedChange={v => update("showLogo", v)} />
        </div>
        {settings.showLogo && (
          <>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Position</Label>
              <Select value={settings.logoPosition} onValueChange={v => update("logoPosition", v as any)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="top" className="text-xs">Top</SelectItem>
                  <SelectItem value="center" className="text-xs">Center</SelectItem>
                  <SelectItem value="bottom" className="text-xs">Bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Scale: {settings.logoScale.toFixed(1)}×</Label>
              <Slider min={0.3} max={3} step={0.1} value={[settings.logoScale]} onValueChange={([v]) => update("logoScale", v)} />
            </div>
          </>
        )}
      </div>

      <Button size="sm" className="w-full" onClick={onApply}>
        <Check className="w-3.5 h-3.5 mr-1" /> Apply Card
      </Button>
    </div>
  );
}
