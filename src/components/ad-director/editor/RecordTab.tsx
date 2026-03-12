import { Button } from "@/components/ui/button";
import { Video, Monitor, Sparkles, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function RecordTab() {
  const { toast } = useToast();

  const items = [
    { icon: <Camera className="w-5 h-5" />, label: "Camera", desc: "Record from webcam" },
    { icon: <Monitor className="w-5 h-5" />, label: "Screen", desc: "Record your screen" },
    { icon: <Video className="w-5 h-5" />, label: "Camera + Screen", desc: "Both simultaneously" },
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Record & Create</h4>
      <div className="space-y-2">
        {items.map(item => (
          <button
            key={item.label}
            onClick={() => toast({ title: "Coming soon", description: `${item.label} recording is under development` })}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center text-muted-foreground">
              {item.icon}
            </div>
            <div>
              <div className="text-xs font-medium">{item.label}</div>
              <div className="text-[10px] text-muted-foreground">{item.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="pt-3 border-t border-border/30">
        <Button
          size="sm"
          className="w-full h-8 text-xs gap-1.5 bg-gradient-to-r from-primary to-accent hover:opacity-90"
          onClick={() => toast({ title: "Coming soon", description: "AI scene generation from text" })}
        >
          <Sparkles className="w-3.5 h-3.5" /> Generate with AI
        </Button>
      </div>
    </div>
  );
}
