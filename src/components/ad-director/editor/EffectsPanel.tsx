import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Blend, Gauge } from "lucide-react";

interface EffectsPanelProps {
  fadeIn: number;
  fadeOut: number;
  speed: number;
  onFadeInChange: (v: number) => void;
  onFadeOutChange: (v: number) => void;
  onSpeedChange: (v: number) => void;
}

const SPEED_OPTIONS = [
  { value: "0.5", label: "0.5×" },
  { value: "0.75", label: "0.75×" },
  { value: "1", label: "1× Normal" },
  { value: "1.25", label: "1.25×" },
  { value: "1.5", label: "1.5×" },
  { value: "2", label: "2×" },
];

export function EffectsPanel({
  fadeIn, fadeOut, speed,
  onFadeInChange, onFadeOutChange, onSpeedChange,
}: EffectsPanelProps) {
  return (
    <div className="p-3 space-y-5">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Blend className="w-3.5 h-3.5" /> Effects
      </h4>

      {/* Fade In */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-xs">Fade in</Label>
          <span className="text-[10px] text-muted-foreground font-mono">{fadeIn.toFixed(1)}s</span>
        </div>
        <Slider
          value={[fadeIn]}
          onValueChange={v => onFadeInChange(v[0])}
          min={0}
          max={5}
          step={0.1}
        />
      </div>

      {/* Fade Out */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-xs">Fade out</Label>
          <span className="text-[10px] text-muted-foreground font-mono">{fadeOut.toFixed(1)}s</span>
        </div>
        <Slider
          value={[fadeOut]}
          onValueChange={v => onFadeOutChange(v[0])}
          min={0}
          max={5}
          step={0.1}
        />
      </div>

      {/* Speed */}
      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1.5">
          <Gauge className="w-3 h-3" /> Speed
        </Label>
        <Select value={String(speed)} onValueChange={v => onSpeedChange(parseFloat(v))}>
          <SelectTrigger className="h-8 text-xs bg-muted/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPEED_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
