import { useState, useEffect, useCallback } from "react";
import { Plus, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useChatSessions, ChatSession } from "@/hooks/useChatSessions";
import { formatDistanceToNow } from "date-fns";

interface AgentHistorySidebarProps {
  agentId: string;
  agentName: string;
  agentRole: string;
  agentImage: string;
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
}

export function AgentHistorySidebar({
  agentId,
  agentName,
  agentRole,
  agentImage,
  activeSessionId,
  onSelectSession,
  onNewChat,
}: AgentHistorySidebarProps) {
  const { sessions, loading, deleteSession } = useChatSessions();

  // Filter sessions for this agent
  const agentSessions = sessions.filter(
    (s) => s.agent_name === agentName
  );

  return (
    <div className="flex flex-col h-full">
      {/* Agent header with image */}
      <div className="relative">
        <div className="aspect-[4/3] overflow-hidden">
          <img
            src={agentImage}
            alt={agentName}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent p-4 pt-12">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">{agentName}</h2>
              <p className="text-xs text-muted-foreground">{agentRole}</p>
            </div>
          </div>
        </div>
      </div>

      {/* New Chat button */}
      <div className="px-3 py-3">
        <Button
          onClick={onNewChat}
          className="w-full"
          variant="default"
        >
          <Plus className="w-4 h-4 mr-2" />
          New chat
        </Button>
      </div>

      {/* Recents label */}
      <div className="px-4 pb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Recents
        </span>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2">
          {loading && (
            <div className="px-2 py-4 text-xs text-muted-foreground text-center">
              Loading...
            </div>
          )}
          {!loading && agentSessions.length === 0 && (
            <div className="px-2 py-4 text-xs text-muted-foreground text-center">
              No conversations yet
            </div>
          )}
          {agentSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg text-sm truncate transition-colors group flex items-center gap-2",
                activeSessionId === session.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground/80 hover:bg-muted"
              )}
            >
              <span className="flex-1 truncate">{session.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(session.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
