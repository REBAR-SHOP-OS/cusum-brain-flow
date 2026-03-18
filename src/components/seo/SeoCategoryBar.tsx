import { cn } from "@/lib/utils";
import { BarChart3, FileText, Megaphone, Sparkles, MapPin, ScrollArea } from "lucide-react";
import type { SeoCategory } from "@/pages/SeoModule";

const categories: { id: SeoCategory; label: string; description: string; icon: React.ElementType; iconColor: string }[] = [
  {
    id: "traffic",
    label: "Traffic & Market",
    description: "Track competitors, analyze markets, uncover growth opportunities.",
    icon: BarChart3,
    iconColor: "text-emerald-500",
  },
  {
    id: "content",
    label: "Content",
    description: "Create SEO-friendly content with AI and competitive data.",
    icon: FileText,
    iconColor: "text-teal-500",
  },
  {
    id: "ai-pr",
    label: "AI PR",
    description: "Get press coverage that shapes your brand's visibility in LLMs.",
    icon: Megaphone,
    iconColor: "text-rose-500",
  },
  {
    id: "ai-visibility",
    label: "AI Visibility",
    description: "Grow your visibility in AI search tools like ChatGPT and Google's AI Mode.",
    icon: Sparkles,
    iconColor: "text-violet-500",
  },
  {
    id: "local",
    label: "Local",
    description: "Manage reviews, boost local search visibility, track local competitors.",
    icon: MapPin,
    iconColor: "text-orange-500",
  },
];

interface Props {
  active: SeoCategory;
  onSelect: (c: SeoCategory) => void;
}

export function SeoCategoryBar({ active, onSelect }: Props) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      {categories.map((cat) => {
        const isActive = active === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              "relative flex flex-col items-start gap-2 min-w-[200px] max-w-[240px] rounded-xl border p-4 text-left transition-all shrink-0",
              isActive
                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
            )}
          >
            {isActive && (
              <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isActive ? "bg-primary/10" : "bg-muted")}>
              <cat.icon className={cn("w-4 h-4", cat.iconColor)} />
            </div>
            <span className="text-sm font-semibold text-foreground">{cat.label}</span>
            <span className="text-xs text-muted-foreground leading-relaxed">{cat.description}</span>
          </button>
        );
      })}
    </div>
  );
}
