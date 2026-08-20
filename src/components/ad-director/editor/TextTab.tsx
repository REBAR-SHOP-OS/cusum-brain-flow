import { Button } from "@/components/ui/button";
import { Type, Plus } from "lucide-react";

interface TextTabProps {
  onAddText: () => void;
}

const TEXT_STYLES = [
  { label: "Heading", preview: "Aa", style: "text-lg font-bold" },
  { label: "Subheading", preview: "Aa", style: "text-sm font-semibold" },
  { label: "Body", preview: "Aa", style: "text-xs" },
  { label: "Caption", preview: "Aa", style: "text-[10px] italic" },
  { label: "Bold Impact", preview: "Aa", style: "text-base font-black uppercase tracking-wider" },
  { label: "Lower Third", preview: "Aa", style: "text-xs font-medium border-l-2 border-primary pl-2" },
];

export function TextTab({ onAddText }: TextTabProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Text</h4>
      <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={onAddText}>
        <Plus className="w-3.5 h-3.5" /> Add Text Overlay
      </Button>
      <div className="space-y-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Presets</span>
        <div className="grid grid-cols-2 gap-2">
          {TEXT_STYLES.map(s => (
            <button
              key={s.label}
              onClick={onAddText}
              className="flex flex-col items-center justify-center p-3 rounded-lg border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-all gap-1"
            >
              <span className={s.style}>{s.preview}</span>
              <span className="text-[9px] text-muted-foreground">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
