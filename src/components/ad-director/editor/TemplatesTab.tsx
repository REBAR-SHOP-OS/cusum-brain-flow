import { LayoutTemplate } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TEMPLATES = [
  { label: "Product Showcase", desc: "Zoom-in reveal with text" },
  { label: "Testimonial", desc: "Quote + profile layout" },
  { label: "Before / After", desc: "Split screen comparison" },
  { label: "Promo Sale", desc: "Bold pricing + CTA" },
  { label: "Social Story", desc: "9:16 vertical format" },
  { label: "Explainer", desc: "Icon + narration style" },
  { label: "Intro / Outro", desc: "Brand logo animation" },
  { label: "Countdown", desc: "Timer + urgency effect" },
];

export function TemplatesTab() {
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Templates</h4>
      <div className="space-y-2">
        {TEMPLATES.map(t => (
          <button
            key={t.label}
            onClick={() => toast({ title: "Coming soon", description: `${t.label} template` })}
            className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
          >
            <div className="w-12 h-8 rounded bg-muted/40 flex items-center justify-center flex-shrink-0">
              <LayoutTemplate className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">{t.label}</div>
              <div className="text-[10px] text-muted-foreground truncate">{t.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
