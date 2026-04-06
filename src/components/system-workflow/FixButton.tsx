import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export function FixButton({
  onClick,
  active,
  count,
}: {
  onClick: () => void;
  active?: boolean;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group fixed bottom-6 left-6 z-40 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition hover:bg-slate-900/80",
        active && "ring-2 ring-rose-400/60",
      )}
      aria-label="Fix"
    >
      <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 ring-1 ring-rose-400/25">
        <Wrench className="h-4 w-4 text-rose-200 drop-shadow-[0_0_10px_rgba(244,63,94,0.35)]" strokeWidth={1.6} />
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.55)]" />
      </span>
      <span className="tracking-tight">Fix</span>
      {!!count && (
        <span className="ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500/15 px-2 text-xs font-semibold text-rose-100 ring-1 ring-rose-400/30">
          {count}
        </span>
      )}
    </button>
  );
}

