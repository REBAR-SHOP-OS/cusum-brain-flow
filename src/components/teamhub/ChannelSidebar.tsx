import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Hash, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeamChannel } from "@/hooks/useTeamChat";

interface ChannelSidebarProps {
  channels: TeamChannel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ChannelSidebar({ channels, selectedId, onSelect }: ChannelSidebarProps) {
  const groupChannels = channels.filter((c) => c.channel_type === "group");
  const dmChannels = channels.filter((c) => c.channel_type === "dm");

  return (
    <div className="flex flex-col h-full border-r border-border bg-card/50 w-60 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-bold tracking-wider uppercase text-foreground">Team Chat</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">Auto-translated messaging</p>
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-auto py-2">
        <div className="px-3 mb-1 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
            Channels
          </span>
        </div>
        {groupChannels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => onSelect(ch.id)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors rounded-md mx-1",
              selectedId === ch.id
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            style={{ width: "calc(100% - 8px)" }}
          >
            <Hash className="w-4 h-4 shrink-0" />
            <span className="truncate">{ch.name}</span>
          </button>
        ))}

        {dmChannels.length > 0 && (
          <>
            <div className="px-3 mt-4 mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                Direct Messages
              </span>
            </div>
            {dmChannels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => onSelect(ch.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors rounded-md mx-1",
                  selectedId === ch.id
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                style={{ width: "calc(100% - 8px)" }}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
