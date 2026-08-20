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

/** Wraps text to fit within maxWidth, returns array of lines */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
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

  // Subtle vignette overlay for text contrast
  const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.75);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  const hasLogo = settings.showLogo && logoImg && logoImg.complete && logoImg.naturalWidth > 0;
  const isSplit = settings.layout === "split";
  const isLeft = settings.layout === "left";
  const isMinimal = settings.layout === "minimal";
  const isLogoTop = settings.layout === "logo-top";
  const PAD = 60;
  const GAP = 30;

  // ── Split layout: logo left, text right ──
  if (isSplit) {
    const halfW = W / 2;
    // Logo on left half
    if (hasLogo) {
      const logoH = Math.min(120 * settings.logoScale, H * 0.4);
      const logoW = (logoImg!.naturalWidth / logoImg!.naturalHeight) * logoH;
      const lx = halfW / 2 - logoW / 2;
      const ly = H / 2 - logoH / 2;
      ctx.drawImage(logoImg!, lx, ly, logoW, logoH);
    }
    // Text stack on right half
    const textX = halfW + PAD;
    const maxTextW = halfW - PAD * 2;
    let ty = H / 2 - 60;

    ctx.textAlign = "left";
    ctx.fillStyle = settings.textColor;
    ctx.font = `bold ${settings.headlineFontSize}px ${settings.fontFamily}`;
    const headLines = wrapText(ctx, settings.headline, maxTextW);
    for (const line of headLines) {
      ctx.fillText(line, textX, ty);
      ty += settings.headlineFontSize + 6;
    }
    ty += GAP * 0.5;

    if (settings.subheadline && !isMinimal) {
      ctx.font = `${settings.subFontSize}px ${settings.fontFamily}`;
      ctx.fillStyle = settings.textColor + "d9";
      const subLines = wrapText(ctx, settings.subheadline, maxTextW);
      for (const line of subLines) {
        ctx.fillText(line, textX, ty);
        ty += settings.subFontSize + 4;
      }
      ty += GAP;
    }

    if (settings.website) {
      ctx.font = `bold ${Math.round(settings.subFontSize * 0.9)}px ${settings.fontFamily}`;
      ctx.fillStyle = settings.textColor;
      ctx.fillText(settings.website, textX, ty);
    }
    return;
  }

  // ── Stack layouts: measure total height then center ──
  const maxW = isLeft ? W - PAD * 2 : W * 0.75;
  const align = isLeft ? "left" : "center";
  const xAnchor = isLeft ? PAD : W / 2;
  ctx.textAlign = align;

  // Measure elements
  const elements: { type: string; height: number; lines?: string[] }[] = [];

  // Logo
  let logoW = 0, logoH = 0;
  if (hasLogo && (isLogoTop || settings.logoPosition === "top")) {
    logoH = Math.min(60 * settings.logoScale, H * 0.2);
    logoW = (logoImg!.naturalWidth / logoImg!.naturalHeight) * logoH;
    elements.push({ type: "logo", height: logoH });
  }

  // Headline
  ctx.font = `bold ${settings.headlineFontSize}px ${settings.fontFamily}`;
  const headLines = wrapText(ctx, settings.headline, maxW);
  const headHeight = headLines.length * (settings.headlineFontSize + 6);
  elements.push({ type: "headline", height: headHeight, lines: headLines });

  // Subheadline
  let subLines: string[] = [];
  if (settings.subheadline && !isMinimal) {
    ctx.font = `${settings.subFontSize}px ${settings.fontFamily}`;
    subLines = wrapText(ctx, settings.subheadline, maxW);
    const subH = subLines.length * (settings.subFontSize + 4);
    elements.push({ type: "sub", height: subH, lines: subLines });
  }

  // CTA pill
  if (settings.cta && !isMinimal) {
    elements.push({ type: "cta", height: 44 });
  }

  // Website
  if (settings.website) {
    elements.push({ type: "website", height: Math.round(settings.subFontSize * 0.9) + 8 });
  }

  // Bottom logo
  if (hasLogo && !isLogoTop && settings.logoPosition !== "top") {
    logoH = Math.min(60 * settings.logoScale, H * 0.2);
    logoW = (logoImg!.naturalWidth / logoImg!.naturalHeight) * logoH;
    elements.push({ type: "logo-bottom", height: logoH });
  }

  const totalH = elements.reduce((s, e) => s + e.height, 0) + (elements.length - 1) * GAP;
  let y = (H - totalH) / 2;

  for (const el of elements) {
    if (el.type === "logo" || el.type === "logo-bottom") {
      const lx = align === "left" ? xAnchor : W / 2 - logoW / 2;
      ctx.drawImage(logoImg!, lx, y, logoW, logoH);
    } else if (el.type === "headline") {
      ctx.fillStyle = settings.textColor;
      ctx.font = `bold ${settings.headlineFontSize}px ${settings.fontFamily}`;
      for (const line of el.lines!) {
        y += settings.headlineFontSize;
        ctx.fillText(line, xAnchor, y);
        y += 6;
      }
      y -= el.height; // reset, we'll add full height below
    } else if (el.type === "sub") {
      ctx.fillStyle = settings.textColor + "d9";
      ctx.font = `${settings.subFontSize}px ${settings.fontFamily}`;
      for (const line of el.lines!) {
        y += settings.subFontSize;
        ctx.fillText(line, xAnchor, y);
        y += 4;
      }
      y -= el.height;
    } else if (el.type === "cta") {
      // Rounded pill button
      const ctaFont = Math.round(settings.subFontSize * 0.7);
      ctx.font = `bold ${ctaFont}px ${settings.fontFamily}`;
      const tw = ctx.measureText(settings.cta).width;
      const pillW = tw + 48;
      const pillH = 40;
      const px = align === "left" ? xAnchor : W / 2 - pillW / 2;
      const py = y + 2;
      ctx.fillStyle = settings.textColor;
      ctx.beginPath();
      ctx.roundRect(px, py, pillW, pillH, 20);
      ctx.fill();
      ctx.fillStyle = settings.gradientStart;
      ctx.textAlign = "center";
      ctx.fillText(settings.cta, px + pillW / 2, py + pillH / 2 + ctaFont * 0.35);
      ctx.textAlign = align;
    } else if (el.type === "website") {
      const wFont = Math.round(settings.subFontSize * 0.9);
      ctx.font = `bold ${wFont}px ${settings.fontFamily}`;
      ctx.fillStyle = settings.textColor + "cc";
      ctx.fillText(settings.website, xAnchor, y + wFont);
    }
    y += el.height + GAP;
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
