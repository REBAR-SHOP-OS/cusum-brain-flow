import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hash, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { TeamChannel, TeamMessage } from "@/hooks/useTeamChat";
import { parseAttachmentLinks, isImageUrl, isImageType, fixChatFileUrl } from "@/lib/chatFileUtils";

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: TeamMessage | null;
  channels: TeamChannel[];
  currentChannelId: string | null;
  onForward: (targetChannelId: string, msg: TeamMessage) => void;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  message,
  channels,
  currentChannelId,
  onForward,
}: ForwardMessageDialogProps) {
  const [search, setSearch] = useState("");

  if (!message) return null;

  const filteredChannels = channels
    .filter((c) => c.id !== currentChannelId)
    .filter((c) => c.channel_type !== "dm")
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  // Build preview
  const { cleanText, parsedAttachments } = parseAttachmentLinks(message.original_text);
  const allAtts = [
    ...(message.attachments || []).map((a) => ({ name: a.name, url: fixChatFileUrl(a.url), type: a.type })),
    ...parsedAttachments.map((a) => ({ name: a.name, url: a.url, type: "" })),
  ];
  const imageAtt = allAtts.find((a) => isImageType(a.type) || isImageUrl(a.url));
  const previewText = cleanText.trim() || (imageAtt ? "📷 Photo" : message.original_text);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Forward Message</DialogTitle>
        </DialogHeader>

        {/* Message preview */}
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border">
          {imageAtt && (
            <img
              src={imageAtt.url}
              alt=""
              className="w-10 h-10 rounded object-cover flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">
              {message.sender?.full_name || "Unknown"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{previewText}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Channel list */}
        <ScrollArea className="max-h-48">
          <div className="space-y-0.5">
            {filteredChannels.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No channels found</p>
            )}
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
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
