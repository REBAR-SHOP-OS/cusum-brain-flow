import { ReactNode, useEffect, useState } from "react";
import { Search, Bell, Settings2, RotateCcw } from "lucide-react";
import { v2StyleVars } from "./theme";

export interface DashboardShellProps {
  title: string;
  subtitle?: string;
  roleSwitcher?: ReactNode;
  shortcuts?: ReactNode;
  statusStrip: ReactNode;
  actionQueue: ReactNode;
  pulse: ReactNode;
  drilldowns?: ReactNode;
}


type SectionKey = "statusStrip" | "actionQueue" | "pulse" | "drilldowns";
type Density = "compact" | "comfortable";

interface DashPrefs {
  visible: Record<SectionKey, boolean>;
  density: Density;
}

const DEFAULTS: DashPrefs = {
  visible: { statusStrip: true, actionQueue: true, pulse: true, drilldowns: true },
  density: "comfortable",
};

function storageKey(title: string) {
  return `dashv2:prefs:${title}`;
}

function loadPrefs(title: string): DashPrefs {
  try {
    const raw = localStorage.getItem(storageKey(title));
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      visible: { ...DEFAULTS.visible, ...(parsed.visible ?? {}) },
      density: parsed.density === "compact" ? "compact" : "comfortable",
    };
  } catch {
    return DEFAULTS;
  }
}

export function DashboardShell({
  title,
  subtitle,
  roleSwitcher,
  statusStrip,
  actionQueue,
  pulse,
  drilldowns,
}: DashboardShellProps) {
  const [prefs, setPrefs] = useState<DashPrefs>(DEFAULTS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs(title));
  }, [title]);

  const update = (next: DashPrefs) => {
    setPrefs(next);
    try { localStorage.setItem(storageKey(title), JSON.stringify(next)); } catch {}
  };

  const toggle = (k: SectionKey) =>
    update({ ...prefs, visible: { ...prefs.visible, [k]: !prefs.visible[k] } });

  const setDensity = (d: Density) => update({ ...prefs, density: d });
  const reset = () => update(DEFAULTS);

  const pad = prefs.density === "compact" ? "px-4 py-3 space-y-3" : "px-5 py-5 space-y-5";
  const gap = prefs.density === "compact" ? "gap-2" : "gap-3";
  const gapLg = prefs.density === "compact" ? "gap-3" : "gap-5";

  return (
    <div
      style={v2StyleVars}
      className="min-h-screen bg-[hsl(var(--v2-canvas))] text-[hsl(var(--v2-text))]"
    >
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-5 h-14 border-b border-[hsl(var(--v2-border))] bg-[hsl(var(--v2-canvas))]/95 backdrop-blur">
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-sm font-semibold tracking-wide truncate">{title}</h1>
          {subtitle && (
            <span className="text-[11px] uppercase tracking-wider text-[hsl(var(--v2-text-muted))] truncate">
              {subtitle}
            </span>
          )}
        </div>
        <div className="flex-1" />
        {roleSwitcher}
        <button className="p-1.5 rounded text-[hsl(var(--v2-text-muted))] hover:text-[hsl(var(--v2-text))]">
          <Search className="w-4 h-4" />
        </button>
        <button className="p-1.5 rounded text-[hsl(var(--v2-text-muted))] hover:text-[hsl(var(--v2-text))] relative">
          <Bell className="w-4 h-4" />
        </button>

        {/* Customize */}
        <div className="relative">
          <button
            onClick={() => setSettingsOpen(v => !v)}
            title="Customize dashboard"
            aria-label="Customize dashboard"
            className="p-1.5 rounded text-[hsl(var(--v2-text-muted))] hover:text-[hsl(var(--v2-text))]"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          {settingsOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setSettingsOpen(false)} />
              <div className="absolute right-0 mt-1 z-30 w-64 rounded-md border border-[hsl(var(--v2-border))] bg-[hsl(var(--v2-panel))] shadow-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-[hsl(var(--v2-border))] flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-[hsl(var(--v2-text-muted))]">Customize</span>
                  <button
                    onClick={reset}
                    className="inline-flex items-center gap-1 text-[11px] text-[hsl(var(--v2-text-muted))] hover:text-[hsl(var(--v2-text))]"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>

                <div className="px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--v2-text-muted))] mb-1.5">Sections</div>
                  {([
                    ["statusStrip", "Status strip"],
                    ["actionQueue", "Action queue"],
                    ["pulse", "Pulse / chart"],
                    ["drilldowns", "Drilldowns"],
                  ] as [SectionKey, string][]).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 py-1 cursor-pointer text-xs text-[hsl(var(--v2-text))]">
                      <input
                        type="checkbox"
                        checked={prefs.visible[k]}
                        onChange={() => toggle(k)}
                        className="accent-[hsl(var(--v2-accent))]"
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="px-3 py-2 border-t border-[hsl(var(--v2-border))]">
                  <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--v2-text-muted))] mb-1.5">Density</div>
                  <div className="flex gap-1">
                    {(["comfortable", "compact"] as Density[]).map(d => (
                      <button
                        key={d}
                        onClick={() => setDensity(d)}
                        className={`flex-1 text-xs px-2 py-1 rounded border capitalize ${
                          prefs.density === d
                            ? "border-[hsl(var(--v2-accent))] bg-[hsl(var(--v2-accent))] text-white"
                            : "border-[hsl(var(--v2-border))] text-[hsl(var(--v2-text-muted))] hover:text-[hsl(var(--v2-text))]"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-3 py-2 border-t border-[hsl(var(--v2-border))] text-[10px] text-[hsl(var(--v2-text-muted))]">
                  Saved per dashboard on this device.
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Body */}
      <div className={pad}>
        {/* Row 1 — Status strip */}
        {prefs.visible.statusStrip && (
          <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 ${gap}`}>
            {statusStrip}
          </div>
        )}

        {/* Row 2 — Action queue + Pulse */}
        {(prefs.visible.actionQueue || prefs.visible.pulse) && (
          <div className={`grid grid-cols-1 lg:grid-cols-5 ${gapLg}`}>
            {prefs.visible.actionQueue && (
              <div className={prefs.visible.pulse ? "lg:col-span-3" : "lg:col-span-5"}>{actionQueue}</div>
            )}
            {prefs.visible.pulse && (
              <div className={prefs.visible.actionQueue ? "lg:col-span-2" : "lg:col-span-5"}>{pulse}</div>
            )}
          </div>
        )}

        {/* Row 3 — Drilldowns */}
        {prefs.visible.drilldowns && drilldowns && (
          <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 ${gapLg}`}>
            {drilldowns}
          </div>
        )}
      </div>
    </div>
  );
}
