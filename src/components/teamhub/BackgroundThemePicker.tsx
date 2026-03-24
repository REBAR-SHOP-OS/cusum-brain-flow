import { useState, useEffect, useCallback } from "react";
import { Paintbrush, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "teamhub_bg_theme";

export interface ThemeOption {
  id: string;
  name: string;
  preview: string; // CSS gradient/color for the swatch
  style: React.CSSProperties;
}

const THEMES: ThemeOption[] = [
  {
    id: "default",
    name: "Default",
    preview: "hsl(222 47% 6%)",
    style: {},
  },
  {
    id: "midnight",
    name: "Midnight",
    preview: "linear-gradient(135deg, hsl(222 50% 4%), hsl(230 40% 10%))",
    style: { background: "linear-gradient(180deg, hsl(222 50% 4%), hsl(230 40% 10%))" },
  },
  {
    id: "ocean",
    name: "Ocean",
    preview: "linear-gradient(135deg, hsl(195 80% 8%), hsl(220 40% 8%))",
    style: { background: "linear-gradient(180deg, hsl(195 80% 8%), hsl(220 40% 8%))" },
  },
  {
    id: "purple",
    name: "Purple Haze",
    preview: "linear-gradient(135deg, hsl(270 60% 10%), hsl(240 30% 8%))",
    style: { background: "linear-gradient(180deg, hsl(270 60% 10%), hsl(240 30% 8%))" },
  },
  {
    id: "forest",
    name: "Forest",
    preview: "linear-gradient(135deg, hsl(160 60% 8%), hsl(200 30% 6%))",
    style: { background: "linear-gradient(180deg, hsl(160 60% 8%), hsl(200 30% 6%))" },
  },
  {
    id: "warm",
    name: "Warm Sunset",
    preview: "linear-gradient(135deg, hsl(20 60% 10%), hsl(350 30% 8%))",
    style: { background: "linear-gradient(180deg, hsl(20 60% 10%), hsl(350 30% 8%))" },
  },
  {
    id: "charcoal",
    name: "Charcoal",
    preview: "hsl(0 0% 8%)",
    style: { background: "hsl(0 0% 8%)" },
  },
  {
    id: "aurora",
    name: "Aurora",
    preview: "linear-gradient(135deg, hsl(172 50% 10%), hsl(260 40% 10%))",
    style: { background: "linear-gradient(180deg, hsl(172 50% 10%), hsl(260 40% 10%), hsl(300 30% 8%))" },
  },
  {
    id: "steel",
    name: "Steel",
    preview: "linear-gradient(135deg, hsl(210 15% 12%), hsl(210 10% 8%))",
    style: { background: "linear-gradient(180deg, hsl(210 15% 12%), hsl(210 10% 8%))" },
  },
  {
    id: "ember",
    name: "Ember",
    preview: "linear-gradient(135deg, hsl(0 50% 10%), hsl(30 40% 6%))",
    style: { background: "linear-gradient(180deg, hsl(0 50% 10%), hsl(30 40% 6%))" },
  },
];

export function useTeamHubTheme() {
  const [themeId, setThemeId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "default";
    } catch {
      return "default";
    }
  });

  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];

  const setTheme = useCallback((id: string) => {
    setThemeId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }, []);

  return { themeId, theme, setTheme };
}

export function BackgroundThemePicker({
  themeId,
  onSelect,
}: {
  themeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary">
          <Paintbrush className="w-4 h-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-3">
        <p className="text-xs font-semibold text-foreground mb-2">Chat Background</p>
        <div className="grid grid-cols-5 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              title={t.name}
              onClick={() => onSelect(t.id)}
              className={cn(
                "w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center",
                themeId === t.id
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-muted-foreground"
              )}
              style={{ background: t.preview }}
            >
              {themeId === t.id && <Check className="w-3.5 h-3.5 text-primary-foreground drop-shadow" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
