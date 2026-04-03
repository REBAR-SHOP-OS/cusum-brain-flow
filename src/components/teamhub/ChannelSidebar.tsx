import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { ProfileEditDialog } from "./ProfileEditDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Hash,
  Plus,
  Search,
  Globe,
  ChevronDown,
  StickyNote,
  ChevronRight,
  Circle,
  X,
  Users,
  Trash2,
} from "lucide-react";
import type { TeamChannel } from "@/hooks/useTeamChat";
import type { Profile } from "@/hooks/useProfiles";
import { useUnreadSenders } from "@/hooks/useUnreadSenders";

interface ChannelSidebarProps {
  channels: TeamChannel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onlineCount: number;
  profiles: Profile[];
  onCreateChannel: () => void;
  onCreateGroup?: () => void;
  onClickMember: (profileId: string, name: string) => void;
  onClose?: () => void;
  myProfile?: Profile;
  onDeleteChannel?: (channelId: string) => void;
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

const PROTECTED_CHANNELS = ["Official Channel", "Official Group", "My Notes"];
const ADMIN_EMAILS = ["radin@rebar.shop", "neel@rebar.shop", "sattar@rebar.shop"];

export function ChannelSidebar({ channels, selectedId, onSelect, onlineCount, profiles, onCreateChannel, onCreateGroup, onClickMember, onClose, myProfile, onDeleteChannel }: ChannelSidebarProps) {
  const { user } = useAuth();
  const [membersOpen, setMembersOpen] = useState(true);
  const [groupsOpen, setGroupsOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<Profile | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<TeamChannel | null>(null);
  const { unreadSenderIds } = useUnreadSenders();
  const isAdmin = ADMIN_EMAILS.includes(user?.email ?? "");

  const officialChannel = channels.filter((c) => c.channel_type === "group" && c.name === "Official Channel");
  const userChannels = channels.filter((c) => c.channel_type === "group" && c.name !== "Official Channel" && c.name !== "Official Group" && c.name !== "My Notes");
  const groupChannels = [...officialChannel, ...userChannels];
  const officialGroup = channels.filter((c) => c.channel_type === "group" && c.name === "Official Group");
  const userGroups = channels.filter((c) => c.channel_type === "group" && c.name !== "Official Channel" && c.name !== "Official Group" && c.name !== "My Notes" && !userChannels.find((uc) => uc.id === c.id));
  // Note: For now, user-created entries appear under Channels. Groups section shows Official Group only.
  const activeProfiles = profiles.filter((p) => 
    p.email?.endsWith("@rebar.shop")
  );
  const totalChannels = groupChannels.length + officialGroup.length + userGroups.length;

  const filteredMembers = searchTerm
    ? activeProfiles.filter((p) => p.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
    : activeProfiles;

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose?.();
  };

  const handleClickMember = (profileId: string, name: string) => {
    if (myProfile && profileId === myProfile.id) {
      onSelect("__my_notes__");
    } else {
      onClickMember(profileId, name);
    }
    onClose?.();
  };

  return (
    <div
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.94),rgba(15,23,42,0.88))] text-slate-100 backdrop-blur-xl transition-all duration-300 ease-in-out",
        onClose ? "w-full" : "w-72 lg:w-80"
      )}
    >
      {/* Workspace Header */}
      <div className="border-b border-white/10 px-4 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-full" onClick={() => myProfile && setProfileEditOpen(true)}>
              <Avatar className="h-10 w-10 cursor-pointer border border-white/10 shadow-[0_0_0_4px_rgba(15,23,42,0.35)] transition-all hover:ring-2 hover:ring-primary/40">
                <AvatarImage src={myProfile?.avatar_url || ""} />
                <AvatarFallback className={cn("text-xs font-bold text-white", getAvatarColor(myProfile?.full_name || ""))}>
                  {getInitials(myProfile?.full_name || "?")}
                </AvatarFallback>
              </Avatar>
            </button>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-300">
                <Globe className="h-3 w-3 text-primary" />
                Team Hub
              </div>
              <h2 className="mt-2 text-base font-semibold tracking-tight text-white whitespace-nowrap">Official Channel</h2>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                <span>{onlineCount} online</span>
                <span className="h-1 w-1 rounded-full bg-slate-600" />
                <span>{totalChannels} spaces</span>
              </div>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 md:hidden" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Members</p>
            <p className="mt-1 text-sm font-semibold text-white">{onlineCount} active</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Translation</p>
            <p className="mt-1 text-sm font-semibold text-primary">Always on</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 rounded-2xl border-white/10 bg-white/5 pl-9 text-xs text-slate-100 placeholder:text-slate-500 focus:border-primary/40 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto px-3 pb-4">
        {/* My Notes */}
        <button
          onClick={() => handleSelect("__my_notes__")}
          className={cn(
            "mb-3 flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-all",
            selectedId === "__my_notes__"
              ? "border-primary/30 bg-primary/15 text-white shadow-[0_16px_30px_-22px_rgba(45,212,191,0.95)]"
              : "border-transparent bg-white/[0.03] text-slate-300 hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
          )}
        >
          <div className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
            selectedId === "__my_notes__"
              ? "border-primary/30 bg-primary/20 text-primary"
              : "border-white/10 bg-white/5 text-slate-400"
          )}>
            <StickyNote className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <span className="block truncate font-medium">My Notes</span>
            <span className="block text-[11px] text-slate-500">Personal drafts and saved thoughts</span>
          </div>
        </button>

        {/* Channels Section */}
        <div className="mb-2 flex items-center justify-between pr-1">
          <span className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
            Channels
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white" onClick={onCreateChannel}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="mb-4 space-y-1">
          {groupChannels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => handleSelect(ch.id)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition-all",
                selectedId === ch.id
                  ? "border-primary/25 bg-primary/12 text-white shadow-[0_18px_32px_-22px_rgba(45,212,191,0.85)]"
                  : "border-transparent bg-white/[0.03] text-slate-300 hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
              )}
            >
              <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
                selectedId === ch.id
                  ? "border-primary/25 bg-primary/15 text-primary"
                  : "border-white/10 bg-white/5 text-slate-500"
              )}>
                <Hash className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <span className="block truncate font-medium">{ch.name}</span>
                <span className="block text-[11px] text-slate-500">
                  {ch.name === "Official Channel" ? "Company-wide announcements" : "Shared workspace"}
                </span>
              </div>
              {isAdmin && !PROTECTED_CHANNELS.includes(ch.name) && (
                <Trash2
                  className="h-3.5 w-3.5 shrink-0 text-destructive/60 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); setChannelToDelete(ch); }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Groups Section */}
        <div className="mt-1 flex items-center justify-between">
          <button
            onClick={() => setGroupsOpen(!groupsOpen)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500 transition-colors hover:text-white"
          >
            {groupsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Groups
          </button>
          {onCreateGroup && (
            <Button variant="ghost" size="icon" className="mr-1 h-7 w-7 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white" onClick={onCreateGroup}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {groupsOpen && (
          <div className="mb-4 space-y-1">
            {officialGroup.map((ch) => (
              <button
                key={ch.id}
                onClick={() => handleSelect(ch.id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition-all",
                  selectedId === ch.id
                    ? "border-primary/25 bg-primary/12 text-white shadow-[0_18px_32px_-22px_rgba(45,212,191,0.85)]"
                    : "border-transparent bg-white/[0.03] text-slate-300 hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
                )}
              >
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
                  selectedId === ch.id
                    ? "border-primary/25 bg-primary/15 text-primary"
                    : "border-white/10 bg-white/5 text-slate-500"
                )}>
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-medium">{ch.name}</span>
                  <span className="block text-[11px] text-slate-500">Group collaboration room</span>
                </div>
                {isAdmin && !PROTECTED_CHANNELS.includes(ch.name) && (
                  <Trash2
                    className="h-3.5 w-3.5 shrink-0 text-destructive/60 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setChannelToDelete(ch); }}
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Team Members */}
        <button
          onClick={() => setMembersOpen(!membersOpen)}
          className="mt-1 flex w-full items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500 transition-colors hover:text-white"
        >
          {membersOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Team Members
          <Badge variant="secondary" className="ml-auto h-5 rounded-full border border-white/10 bg-white/5 px-2 text-[9px] text-slate-200">
            {onlineCount}
          </Badge>
        </button>

        {membersOpen && (
          <div className="mb-3 mt-1 space-y-1">
            {filteredMembers.map((p) => (
              <button
                key={p.id}
                onClick={() => handleClickMember(p.id, p.full_name)}
                className="flex w-full items-center gap-3 rounded-2xl border border-transparent bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:border-white/10 hover:bg-white/[0.06]"
              >
                <div className="relative cursor-pointer" onClick={(e) => { e.stopPropagation(); setPreviewProfile(p); }}>
                  <Avatar className="h-9 w-9 border border-white/10">
                    <AvatarImage src={p.avatar_url || ""} />
                    <AvatarFallback className={cn("text-[9px] font-bold text-white", getAvatarColor(p.full_name))}>
                      {getInitials(p.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <Circle className="absolute -bottom-0 -right-0 h-2.5 w-2.5 fill-emerald-400 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-100">{p.full_name}</span>
                  <span className="block truncate text-[11px] text-slate-500">{p.title || "Team member"}</span>
                </div>
                {unreadSenderIds.has(p.id) && (
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
                )}
                {p.preferred_language && p.preferred_language !== "en" && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-400">
                    {p.preferred_language.toUpperCase()}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {myProfile && (
        <ProfileEditDialog
          open={profileEditOpen}
          onClose={() => setProfileEditOpen(false)}
          profile={myProfile}
        />
      )}

      <Dialog open={!!previewProfile} onOpenChange={() => setPreviewProfile(null)}>
        <DialogContent className="max-w-xs flex flex-col items-center gap-4 p-6">
          <Avatar className="w-40 h-40 border-2 border-border">
            <AvatarImage src={previewProfile?.avatar_url || ""} className="object-cover" />
            <AvatarFallback className={cn("text-4xl font-bold text-white", getAvatarColor(previewProfile?.full_name || ""))}>
              {getInitials(previewProfile?.full_name || "?")}
            </AvatarFallback>
          </Avatar>
          <h3 className="text-lg font-semibold text-foreground">{previewProfile?.full_name}</h3>
          {previewProfile?.title && (
            <p className="text-sm text-muted-foreground">{previewProfile.title}</p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!channelToDelete} onOpenChange={() => setChannelToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{channelToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this channel and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (channelToDelete && onDeleteChannel) {
                  onDeleteChannel(channelToDelete.id);
                }
                setChannelToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
