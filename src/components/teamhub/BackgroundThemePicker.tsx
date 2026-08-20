import { useState, useCallback } from "react";
import { Paintbrush, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

const STORAGE_KEY = "teamhub_bg_theme";

export interface ThemeOption {
  id: string;
  name: string;
  preview: string;
  lightStyle: React.CSSProperties;
  darkStyle: React.CSSProperties;
}

const DARK_TEXT = "hsl(222 47% 11%)";
const LIGHT_TEXT = "hsl(210 40% 96%)";

const THEMES: ThemeOption[] = [
  {
    id: "default",
    name: "Default",
    preview: "hsl(222 47% 6%)",
    lightStyle: {},
    darkStyle: {},
  },
  {
    id: "sky",
    name: "Sky Blue",
    preview: "linear-gradient(135deg, hsl(210 65% 65%), hsl(220 60% 55%))",
    lightStyle: { background: "linear-gradient(180deg, hsl(210 65% 68%), hsl(220 60% 58%))", color: DARK_TEXT },
    darkStyle: { background: "linear-gradient(180deg, hsl(215 50% 16%), hsl(220 45% 12%))", color: LIGHT_TEXT },
  },
  {
    id: "mint",
    name: "Mint Green",
    preview: "linear-gradient(135deg, hsl(160 55% 60%), hsl(170 50% 50%))",
    lightStyle: { background: "linear-gradient(180deg, hsl(160 55% 65%), hsl(170 50% 55%))", color: DARK_TEXT },
    darkStyle: { background: "linear-gradient(180deg, hsl(160 40% 15%), hsl(170 35% 11%))", color: LIGHT_TEXT },
  },
  {
    id: "lavender",
    name: "Lavender",
    preview: "linear-gradient(135deg, hsl(270 55% 68%), hsl(260 50% 58%))",
    lightStyle: { background: "linear-gradient(180deg, hsl(270 55% 72%), hsl(260 50% 62%))", color: DARK_TEXT },
    darkStyle: { background: "linear-gradient(180deg, hsl(270 40% 16%), hsl(260 35% 12%))", color: LIGHT_TEXT },
  },
  {
    id: "peach",
    name: "Peach",
    preview: "linear-gradient(135deg, hsl(20 70% 68%), hsl(15 65% 58%))",
    lightStyle: { background: "linear-gradient(180deg, hsl(20 70% 72%), hsl(15 65% 62%))", color: DARK_TEXT },
    darkStyle: { background: "linear-gradient(180deg, hsl(20 45% 16%), hsl(15 40% 12%))", color: LIGHT_TEXT },
  },
  {
    id: "rose",
    name: "Rose",
    preview: "linear-gradient(135deg, hsl(340 55% 65%), hsl(350 50% 55%))",
    lightStyle: { background: "linear-gradient(180deg, hsl(340 55% 70%), hsl(350 50% 60%))", color: DARK_TEXT },
    darkStyle: { background: "linear-gradient(180deg, hsl(340 40% 16%), hsl(350 35% 12%))", color: LIGHT_TEXT },
  },
  {
    id: "sand",
    name: "Sand",
    preview: "linear-gradient(135deg, hsl(40 60% 65%), hsl(35 55% 55%))",
    lightStyle: { background: "linear-gradient(180deg, hsl(40 60% 70%), hsl(35 55% 60%))", color: DARK_TEXT },
    darkStyle: { background: "linear-gradient(180deg, hsl(40 35% 15%), hsl(35 30% 11%))", color: LIGHT_TEXT },
  },
  {
    id: "teal",
    name: "Teal",
    preview: "linear-gradient(135deg, hsl(180 55% 55%), hsl(190 50% 45%))",
    lightStyle: { background: "linear-gradient(180deg, hsl(180 55% 60%), hsl(190 50% 50%))", color: DARK_TEXT },
    darkStyle: { background: "linear-gradient(180deg, hsl(180 40% 14%), hsl(190 35% 10%))", color: LIGHT_TEXT },
  },
  {
    id: "lilac",
    name: "Lilac",
    preview: "linear-gradient(135deg, hsl(280 50% 68%), hsl(290 45% 58%))",
    lightStyle: { background: "linear-gradient(180deg, hsl(280 50% 72%), hsl(290 45% 62%))", color: DARK_TEXT },
    darkStyle: { background: "linear-gradient(180deg, hsl(280 35% 16%), hsl(290 30% 12%))", color: LIGHT_TEXT },
  },
  {
    id: "cloud",
    name: "Cloud",
    preview: "linear-gradient(135deg, hsl(220 30% 72%), hsl(220 25% 62%))",
    lightStyle: { background: "linear-gradient(180deg, hsl(220 30% 75%), hsl(220 25% 65%))", color: DARK_TEXT },
    darkStyle: { background: "linear-gradient(180deg, hsl(220 20% 14%), hsl(220 15% 10%))", color: LIGHT_TEXT },
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

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const selected = THEMES.find((t) => t.id === themeId) || THEMES[0];
  const style = isDark ? selected.darkStyle : selected.lightStyle;

  const theme = { ...selected, style };

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
