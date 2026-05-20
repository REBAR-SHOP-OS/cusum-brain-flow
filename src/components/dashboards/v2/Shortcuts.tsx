import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

export interface ShortcutItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export function ShortcutBar({ items }: { items: ShortcutItem[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Link
            key={it.to + it.label}
            to={it.to}
            className="group flex items-center gap-2 px-3 py-2.5 rounded-md border border-[hsl(var(--v2-border))] bg-[hsl(var(--v2-panel))] hover:bg-[hsl(var(--v2-panel-2))] hover:border-[hsl(var(--v2-accent))] transition-colors"
          >
            <Icon className="w-4 h-4 text-[hsl(var(--v2-text-muted))] group-hover:text-[hsl(var(--v2-accent))] shrink-0" />
            <span className="text-xs font-medium text-[hsl(var(--v2-text))] truncate">{it.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
