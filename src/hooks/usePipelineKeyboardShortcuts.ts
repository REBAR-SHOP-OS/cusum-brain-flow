import { useEffect, useCallback } from "react";

interface ShortcutHandlers {
  onSearch: () => void;
  onNewLead: () => void;
  onEscape: () => void;
  onSelectAll?: () => void;
}

/**
 * Keyboard shortcuts for pipeline:
 * / — Focus search
 * n — New lead
 * Escape — Clear selection / close panels
 * Ctrl+A — Select all visible leads
 */
export function usePipelineKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger in inputs/textareas/selects
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
          handlers.onEscape();
        }
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        handlers.onSearch();
      } else if (e.key === "n" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handlers.onNewLead();
      } else if (e.key === "Escape") {
        handlers.onEscape();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "a" && handlers.onSelectAll) {
        e.preventDefault();
        handlers.onSelectAll();
      }
    },
    [handlers]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
