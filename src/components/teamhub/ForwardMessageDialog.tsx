import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hash, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TeamChannel, TeamMessage } from "@/hooks/useTeamChat";
import type { Profile } from "@/hooks/useProfiles";
import { parseAttachmentLinks, isImageUrl, isImageType, fixChatFileUrl } from "@/lib/chatFileUtils";

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: TeamMessage | null;
  channels: TeamChannel[];
  currentChannelId: string | null;
  onForward: (targetChannelId: string, msg: TeamMessage) => void;
  profiles?: Profile[];
  onForwardToMember?: (profileId: string, msg: TeamMessage) => void;
  currentProfileId?: string;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  message,
  channels,
  currentChannelId,
  onForward,
  profiles = [],
  onForwardToMember,
  currentProfileId,
}: ForwardMessageDialogProps) {
  const [search, setSearch] = useState("");

  if (!message) return null;

  const filteredChannels = channels
    .filter((c) => c.id !== currentChannelId)
    .filter((c) => c.name === "Official Channel" || c.name === "Official Group")
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const teamMembers = profiles
    .filter((p) => p.email?.endsWith("@rebar.shop"))
    .filter((p) => p.id !== currentProfileId)
    .filter((p) => p.full_name?.toLowerCase().includes(search.toLowerCase()));

  // Build preview
  const { cleanText, parsedAttachments } = parseAttachmentLinks(message.original_text);
  const allAtts = [
    ...(message.attachments || []).map((a) => ({ name: a.name, url: fixChatFileUrl(a.url), type: a.type })),
    ...parsedAttachments.map((a) => ({ name: a.name, url: a.url, type: "" })),
  ];
  const imageAtt = allAtts.find((a) => isImageType(a.type) || isImageUrl(a.url));
  const previewText = cleanText.trim() || (imageAtt ? "📷 Photo" : message.original_text);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Forward Message</DialogTitle>
        </DialogHeader>

        {/* Message preview */}
        <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50 border border-border">
          {imageAtt && (
            <img
              src={imageAtt.url}
              alt=""
              className="w-10 h-10 rounded object-cover flex-shrink-0 mt-0.5"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">
              {message.sender?.full_name || "Unknown"}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2 break-words">{previewText}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search channels or members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Channel & Members list */}
        <ScrollArea className="max-h-56">
          <div className="space-y-1">
            {/* Channels section */}
            {filteredChannels.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-1">
                  Channels
                </p>
                {filteredChannels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => {
                      onForward(ch.id, message);
                      onOpenChange(false);
                      setSearch("");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-muted/80 transition-colors text-left"
                  >
                    <Hash className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-foreground truncate">{ch.name}</span>
                  </button>
                ))}
              </>
            )}

            {/* Team Members section */}
            {teamMembers.length > 0 && onForwardToMember && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-2">
                  <Users className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                  Team Members
                </p>
                {teamMembers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onForwardToMember(p.id, message);
                      onOpenChange(false);
                      setSearch("");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-muted/80 transition-colors text-left"
                  >
                    <Avatar className="w-6 h-6 flex-shrink-0">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                        {getInitials(p.full_name || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground truncate">{p.full_name}</span>
                  </button>
                ))}
              </>
            )}

            {filteredChannels.length === 0 && teamMembers.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No results found</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
