import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Image, Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { LogoSettings } from "@/types/editorSettings";
import type { BrandProfile } from "@/types/adDirector";

interface LogoTabProps {
  logo: LogoSettings;
  brand: BrandProfile;
  onChange: (s: LogoSettings) => void;
  onDeleteLogo?: () => void;
  onReplaceLogo?: (file: File) => void;
}

export function LogoTab({ logo, brand, onChange, onDeleteLogo, onReplaceLogo }: LogoTabProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const update = (patch: Partial<LogoSettings>) => onChange({ ...logo, ...patch });

  const handleReplace = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onReplaceLogo?.(file);
    toast({ title: "Logo replaced", description: file.name });
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Logo</h4>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Preview */}
      <div className="rounded-lg border border-border/30 p-4 flex items-center justify-center bg-muted/20 min-h-[80px]">
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt="Logo" className="max-h-16 max-w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Image className="w-8 h-8" />
            <span className="text-[10px]">No logo uploaded</span>
          </div>
        )}
      </div>

      {/* Position */}
      <div className="space-y-2">
        <Label className="text-xs">Position</Label>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <span className="text-[10px] text-muted-foreground">X (%)</span>
            <Input type="number" value={logo.posX} onChange={e => update({ posX: +e.target.value })} className="h-8 text-xs bg-muted/30" min={0} max={100} />
          </div>
          <div className="flex-1 space-y-1">
            <span className="text-[10px] text-muted-foreground">Y (%)</span>
            <Input type="number" value={logo.posY} onChange={e => update({ posY: +e.target.value })} className="h-8 text-xs bg-muted/30" min={0} max={100} />
          </div>
        </div>
      </div>

      {/* Zoom */}
      <div className="space-y-1">
        <div className="flex justify-between">
          <Label className="text-xs">Zoom</Label>
          <span className="text-[10px] text-muted-foreground">{logo.zoom}%</span>
        </div>
        <Slider value={[logo.zoom]} onValueChange={v => update({ zoom: v[0] })} min={20} max={200} />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-border/30">
        <Button
          variant="destructive"
          size="sm"
          className="h-8 text-xs gap-1 flex-1"
          onClick={() => { onDeleteLogo?.(); toast({ title: "Logo removed" }); }}
        >
          <Trash2 className="w-3 h-3" /> Delete
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1 flex-1" onClick={handleReplace}>
          <Upload className="w-3 h-3" /> Replace
        </Button>
      </div>

      <Button size="sm" className="w-full h-8 text-xs" onClick={() => toast({ title: "Logo settings saved" })}>
        Save changes
      </Button>
    </div>
  );
}
