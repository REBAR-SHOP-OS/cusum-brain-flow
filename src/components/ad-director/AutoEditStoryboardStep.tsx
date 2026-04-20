import { Trash2, ArrowUp, ArrowDown, Sparkles, Film } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SceneCut {
  id: string;
  clipIndex: number;
  start: number;
  end: number;
  description: string;
}

interface AutoEditStoryboardStepProps {
  scenes: SceneCut[];
  summary?: string;
  videoDuration: number;
  clipCount: number;
  onChange: (next: SceneCut[]) => void;
  onGenerate: () => void;
  onBack: () => void;
}

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = (t - m * 60).toFixed(1);
  return `${m}:${s.padStart(4, "0")}`;
}

export function AutoEditStoryboardStep({
  scenes,
  summary,
  videoDuration,
  clipCount,
  onChange,
  onGenerate,
  onBack,
}: AutoEditStoryboardStepProps) {
  const total = scenes.reduce((acc, s) => acc + (s.end - s.start), 0);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...scenes];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  };

  const remove = (idx: number) => {
    const next = scenes.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 text-emerald-300" />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-100">AI Storyboard Suggestion</p>
            <p className="text-xs text-emerald-100/70">
              {summary || `Best moments from ${clipCount} clip${clipCount > 1 ? "s" : ""}.`}
            </p>
          </div>
          <div className="text-right text-xs text-white/60">
            <div>{scenes.length} scenes</div>
            <div className="text-white/40">~{total.toFixed(1)}s of {videoDuration.toFixed(1)}s</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        <div className="space-y-2">
          {scenes.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-xs font-semibold text-emerald-200">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {clipCount > 1 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-200">
                      <Film className="h-2.5 w-2.5" />
                      Clip {s.clipIndex + 1}
                    </span>
                  )}
                  <p className="truncate text-sm text-white">{s.description || "Scene"}</p>
                </div>
                <p className="text-[11px] text-white/45">
                  {fmt(s.start)} → {fmt(s.end)} · {(s.end - s.start).toFixed(1)}s
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-white/50 hover:bg-white/5 hover:text-white"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-white/50 hover:bg-white/5 hover:text-white"
                  onClick={() => move(i, 1)}
                  disabled={i === scenes.length - 1}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-rose-300/70 hover:bg-rose-500/10 hover:text-rose-200"
                  onClick={() => remove(i)}
                  aria-label="Delete scene"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <Button type="button" variant="ghost" onClick={onBack} className="text-white/70 hover:text-white">
          ← Upload different clips
        </Button>
        <Button
          type="button"
          onClick={onGenerate}
          disabled={scenes.length === 0}
          className="bg-emerald-500 text-white hover:bg-emerald-600"
        >
          Generate Final Video →
        </Button>
      </div>
    </div>
  );
}
