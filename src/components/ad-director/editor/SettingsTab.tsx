import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EditorSettings } from "@/types/editorSettings";

interface SettingsTabProps {
  settings: EditorSettings;
  onChange: (s: EditorSettings) => void;
}

const OVERLAY_PRESETS = ["None", "Vignette", "Film Grain", "Light Leak", "Dust & Scratches"];
const TRANSITION_PRESETS = ["None", "Crossfade", "Wipe Left", "Zoom In", "Slide Up"];
const SUBTITLE_PRESETS = ["None", "Standard", "Bold Centered", "Karaoke", "Minimal"];
const STICKER_PRESETS = ["None", "Emoji Reactions", "Call-outs", "Arrows"];
const TEXT_PRESETS = ["None", "Minimal", "Bold Impact", "Lower Third", "Full Screen"];

function PresetSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs bg-muted/30">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SettingsTab({ settings, onChange }: SettingsTabProps) {
  const update = (patch: Partial<EditorSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Global Settings</h4>

      <PresetSelect label="Overlay Preset" value={settings.overlayPreset} options={OVERLAY_PRESETS} onChange={v => update({ overlayPreset: v })} />
      <PresetSelect label="Transition Preset" value={settings.transitionPreset} options={TRANSITION_PRESETS} onChange={v => update({ transitionPreset: v })} />
      <PresetSelect label="Subtitle Preset" value={settings.subtitlePreset} options={SUBTITLE_PRESETS} onChange={v => update({ subtitlePreset: v })} />
      <PresetSelect label="Sticker Preset" value={settings.stickerPreset} options={STICKER_PRESETS} onChange={v => update({ stickerPreset: v })} />
      <PresetSelect label="Text Preset" value={settings.textPreset} options={TEXT_PRESETS} onChange={v => update({ textPreset: v })} />

      {/* Volume sliders */}
      <div className="space-y-3 pt-3 border-t border-border/30">
        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-xs">SFX Volume</Label>
            <span className="text-[10px] text-muted-foreground">{settings.sfxVolume}%</span>
          </div>
          <Slider value={[settings.sfxVolume]} onValueChange={v => update({ sfxVolume: v[0] })} min={0} max={100} />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-xs">Media Volume</Label>
            <span className="text-[10px] text-muted-foreground">{settings.mediaVolume}%</span>
          </div>
          <Slider value={[settings.mediaVolume]} onValueChange={v => update({ mediaVolume: v[0] })} min={0} max={100} />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button size="sm" className="flex-1 h-8 text-xs">Save changes</Button>
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">Reset</Button>
      </div>
    </div>
  );
}
