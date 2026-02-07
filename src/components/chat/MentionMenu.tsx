import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { User, Building2 } from "lucide-react";

interface MentionItem {
  id: string;
  label: string;
  subtitle?: string;
  type: "team" | "customer";
}

interface MentionMenuProps {
  isOpen: boolean;
  filter: string;
  selectedIndex: number;
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
}

export function MentionMenu({ isOpen, filter, selectedIndex, onSelect, onClose }: MentionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<MentionItem[]>([]);

  const loadMentions = useCallback(async () => {
    try {
      const [profilesRes, customersRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, title")
          .ilike("full_name", `%${filter}%`)
          .limit(5),
        supabase
          .from("customers")
          .select("id, name, company_name")
          .ilike("name", `%${filter}%`)
          .limit(5),
      ]);

      const mentionItems: MentionItem[] = [
        ...(profilesRes.data || []).map((p) => ({
          id: p.id,
          label: p.full_name,
          subtitle: p.title || "Team member",
          type: "team" as const,
        })),
        ...(customersRes.data || []).map((c) => ({
          id: c.id,
          label: c.name,
          subtitle: c.company_name || "Customer",
          type: "customer" as const,
        })),
      ];

      setItems(mentionItems);
    } catch (err) {
      console.error("Failed to load mentions:", err);
    }
  }, [filter]);

  useEffect(() => {
    if (isOpen) loadMentions();
  }, [isOpen, loadMentions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || items.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 mb-2 w-[280px] bg-popover border border-border rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">Mention someone</span>
      </div>
      <div className="max-h-[200px] overflow-y-auto py-1">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
              i === selectedIndex % items.length
                ? "bg-primary/10"
                : "hover:bg-muted/50"
            )}
          >
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
              {item.type === "team" ? (
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{item.label}</div>
              <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
