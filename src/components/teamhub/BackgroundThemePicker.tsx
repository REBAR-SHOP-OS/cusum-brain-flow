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

const DARK_TEXT = "hsl(222 47% 11%)";

const THEMES: ThemeOption[] = [
  {
    id: "default",
    name: "Default",
    preview: "hsl(222 47% 6%)",
    style: {},
  },
  {
    id: "sky",
    name: "Sky Blue",
    preview: "linear-gradient(135deg, hsl(210 60% 85%), hsl(220 50% 75%))",
    style: { background: "linear-gradient(180deg, hsl(210 60% 85%), hsl(220 50% 75%))", color: DARK_TEXT },
  },
  {
    id: "mint",
    name: "Mint Green",
    preview: "linear-gradient(135deg, hsl(160 40% 85%), hsl(170 35% 75%))",
    style: { background: "linear-gradient(180deg, hsl(160 40% 85%), hsl(170 35% 75%))", color: DARK_TEXT },
  },
  {
    id: "lavender",
    name: "Lavender",
    preview: "linear-gradient(135deg, hsl(270 40% 85%), hsl(260 35% 78%))",
    style: { background: "linear-gradient(180deg, hsl(270 40% 85%), hsl(260 35% 78%))", color: DARK_TEXT },
  },
  {
    id: "peach",
    name: "Peach",
    preview: "linear-gradient(135deg, hsl(20 60% 88%), hsl(15 50% 80%))",
    style: { background: "linear-gradient(180deg, hsl(20 60% 88%), hsl(15 50% 80%))", color: DARK_TEXT },
  },
  {
    id: "rose",
    name: "Rose",
    preview: "linear-gradient(135deg, hsl(340 40% 88%), hsl(350 35% 80%))",
    style: { background: "linear-gradient(180deg, hsl(340 40% 88%), hsl(350 35% 80%))", color: DARK_TEXT },
  },
  {
    id: "sand",
    name: "Sand",
    preview: "linear-gradient(135deg, hsl(40 40% 88%), hsl(35 35% 80%))",
    style: { background: "linear-gradient(180deg, hsl(40 40% 88%), hsl(35 35% 80%))", color: DARK_TEXT },
  },
  {
    id: "teal",
    name: "Teal",
    preview: "linear-gradient(135deg, hsl(180 40% 82%), hsl(190 35% 72%))",
    style: { background: "linear-gradient(180deg, hsl(180 40% 82%), hsl(190 35% 72%))", color: DARK_TEXT },
  },
  {
    id: "lilac",
    name: "Lilac",
    preview: "linear-gradient(135deg, hsl(280 35% 88%), hsl(290 30% 80%))",
    style: { background: "linear-gradient(180deg, hsl(280 35% 88%), hsl(290 30% 80%))", color: DARK_TEXT },
  },
  {
    id: "cloud",
    name: "Cloud",
    preview: "linear-gradient(135deg, hsl(220 15% 90%), hsl(220 10% 82%))",
    style: { background: "linear-gradient(180deg, hsl(220 15% 90%), hsl(220 10% 82%))", color: DARK_TEXT },
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
              {themeId === t.id && <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
