import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Hash,
  Users,
  Plus,
  Search,
  MessageSquare,
  Globe,
  ChevronDown,
  ChevronRight,
  Circle,
  X,
  Headphones,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TeamChannel } from "@/hooks/useTeamChat";
import type { Profile } from "@/hooks/useProfiles";

interface ChannelSidebarProps {
  channels: TeamChannel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onlineCount: number;
  profiles: Profile[];
  onCreateChannel: () => void;
  onClickMember: (profileId: string, name: string) => void;
  onClose?: () => void;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const avatarColors = [
  "bg-violet-500", "bg-amber-500", "bg-pink-500", "bg-teal-500",
  "bg-blue-500", "bg-red-500", "bg-emerald-500", "bg-indigo-500",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function ChannelSidebar({ channels, selectedId, onSelect, onlineCount, profiles, onCreateChannel, onClickMember, onClose }: ChannelSidebarProps) {
  const navigate = useNavigate();
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [openSupportCount, setOpenSupportCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from("support_conversations")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "assigned", "pending"]);
      setOpenSupportCount(count ?? 0);
    };
    fetchCount();
    const channel = supabase
      .channel("support-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, () => fetchCount())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const groupChannels = channels.filter((c) => c.channel_type === "group");
  const dmChannels = channels.filter((c) => c.channel_type === "dm");
  const activeProfiles = profiles.filter((p) => p.is_active !== false);

  const filteredMembers = searchTerm
    ? activeProfiles.filter((p) => p.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
    : activeProfiles;

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose?.();
  };

  const handleClickMember = (profileId: string, name: string) => {
    onClickMember(profileId, name);
    onClose?.();
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full border-r border-border bg-card/30 backdrop-blur-sm shrink-0 transition-all duration-300 ease-in-out overflow-hidden",
        onClose ? "w-full" : "w-64 lg:w-72"
      )}
    >
      {/* Workspace Header */}
      <div className="p-3 md:p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight whitespace-nowrap">Team Hub</h2>
              <div className="flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-primary" />
                <span className="text-[10px] text-primary font-medium whitespace-nowrap">Auto-translated</span>
              </div>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs bg-muted/50 border-transparent focus:border-primary/30"
            />
          </div>
        </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto py-1 px-2">
            {/* Channels Section */}
            <div className="flex items-center justify-between pr-1">
              <button
                onClick={() => setChannelsOpen(!channelsOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                {channelsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Channels
                <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 h-4">
                  {groupChannels.length}
                </Badge>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onCreateChannel}
                title="Create channel"
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>

            {channelsOpen && (
              <div className="space-y-0.5 mb-3">
                {groupChannels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => handleSelect(ch.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-2 md:py-1.5 text-sm rounded-lg transition-all group",
                      selectedId === ch.id
                        ? "bg-primary/10 text-primary font-semibold shadow-sm shadow-primary/5"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <Hash className={cn("w-4 h-4 shrink-0", selectedId === ch.id ? "text-primary" : "text-muted-foreground/60")} />
                    <span className="truncate flex-1 text-left">{ch.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* DMs Section */}
            <>
              <button
                onClick={() => setDmsOpen(!dmsOpen)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                {dmsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Direct Messages
                <Badge variant="secondary" className="ml-auto text-[9px] px-1 py-0 h-4">
                  {dmChannels.length + 1}
                </Badge>
              </button>
              {dmsOpen && (
                <div className="space-y-0.5 mb-3">
                  {/* SUPPORT entry */}
                  <button
                    onClick={() => { navigate("/support-inbox"); onClose?.(); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 md:py-1.5 text-sm rounded-lg transition-all hover:bg-muted/50 group"
                  >
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
                      <Headphones className="w-3 h-3 text-white" />
                    </div>
                    <span className="font-bold text-foreground tracking-wide">SUPPORT</span>
                    {openSupportCount > 0 && (
                      <Badge className="ml-auto bg-orange-500 text-white border-transparent text-[9px] px-1.5 py-0 h-4">
                        {openSupportCount}
                      </Badge>
                    )}
                  </button>
                  {dmChannels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => handleSelect(ch.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-2 md:py-1.5 text-sm rounded-lg transition-all",
                        selectedId === ch.id
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <Users className="w-4 h-4 shrink-0" />
                      <span className="truncate">{ch.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
            {/* Team Members */}
            <button
              onClick={() => setMembersOpen(!membersOpen)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors mt-2"
            >
              {membersOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Team Members
              <Badge variant="secondary" className="ml-auto text-[9px] px-1 py-0 h-4">
                {onlineCount}
              </Badge>
            </button>

            {membersOpen && (
              <div className="space-y-0.5 mb-3">
                {filteredMembers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleClickMember(p.id, p.full_name)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 md:py-1.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-left"
                  >
                    <div className="relative">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={p.avatar_url || ""} />
                        <AvatarFallback className={cn("text-[9px] font-bold text-white", getAvatarColor(p.full_name))}>
                          {getInitials(p.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <Circle className="w-2 h-2 text-emerald-500 fill-emerald-500 absolute -bottom-0 -right-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-foreground truncate block">{p.full_name}</span>
                    </div>
                    {p.preferred_language && p.preferred_language !== "en" && (
                      <span className="text-[9px] text-muted-foreground/60">{p.preferred_language.toUpperCase()}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
      </div>
    </div>
  );
}
