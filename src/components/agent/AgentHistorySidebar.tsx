import { useState } from "react";
import { format } from "date-fns";
import { Plus, Settings, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChatSession } from "@/hooks/useChatSessions";
import { AgentSettingsDialog } from "./AgentSettingsDialog";
import { EisenhowerTeamReportDialog } from "./EisenhowerTeamReportDialog";
import { useUserRole } from "@/hooks/useUserRole";

interface AgentHistorySidebarProps {
  agentId: string;
  agentName: string;
  agentRole: string;
  agentImage: string;
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  sessions: ChatSession[];
  loading: boolean;
  deleteSession: (id: string) => void;
}

export function AgentHistorySidebar({
  agentId,
  agentName,
  agentRole,
  agentImage,
  activeSessionId,
  onSelectSession,
  onNewChat,
  sessions,
  loading,
  deleteSession,
}: AgentHistorySidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamReportOpen, setTeamReportOpen] = useState(false);
  const { isAdmin } = useUserRole();
  const isEisenhower = agentId === "eisenhower";

  // Sessions are pre-filtered by parent
  const agentSessions = sessions;

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Agent header with image - full width, cropped to fit */}
        <div className="relative">
          <div className="w-full aspect-[4/3] overflow-hidden">
            <img
              src={agentImage}
              alt={agentName}
              className="w-full h-full object-cover object-top"
            />
          </div>
          {/* Settings gear - top right over image */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center hover:bg-background/80 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent p-4 pt-12">
            <div>
              <h2 className="text-base font-bold">{agentName}</h2>
              <p className="text-xs text-muted-foreground">{agentRole}</p>
            </div>
          </div>
        </div>

        {/* New Chat button */}
        <div className="px-3 py-3 space-y-2">
          <Button
            onClick={onNewChat}
            className="w-full"
            variant="default"
          >
            <Plus className="w-4 h-4 mr-2" />
            New chat
          </Button>
          {isEisenhower && isAdmin && (
            <Button
              onClick={() => setTeamReportOpen(true)}
              className="w-full"
              variant="outline"
            >
              <Users className="w-4 h-4 mr-2" />
              Team Reports
            </Button>
          )}
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
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSession(session.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSelectSession(session.id); }}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-sm truncate transition-colors group flex items-center gap-2 cursor-pointer",
                  activeSessionId === session.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground/80 hover:bg-muted"
                )}
              >
                <span className="flex-1 truncate text-xs">
                  {agentId === "social" ? (
                    session.title
                  ) : (
                    <span className="flex flex-col">
                      <span className="truncate">{session.title}</span>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(session.updated_at), "yyyy-MM-dd")}</span>
                    </span>
                  )}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    deleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all flex-shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Agent Settings Dialog */}
      <AgentSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        agentName={agentName}
        agentImage={agentImage}
      />

      {/* Eisenhower Team Report Dialog */}
      {isEisenhower && (
        <EisenhowerTeamReportDialog
          open={teamReportOpen}
          onOpenChange={setTeamReportOpen}
        />
      )}
    </>
  );
}
