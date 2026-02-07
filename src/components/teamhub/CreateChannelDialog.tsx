import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Hash, Loader2, Users, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/hooks/useProfiles";

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: Profile[];
  onCreateChannel: (data: {
    name: string;
    description: string;
    memberIds: string[];
  }) => Promise<void>;
  isCreating: boolean;
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

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export function CreateChannelDialog({
  open,
  onOpenChange,
  profiles,
  onCreateChannel,
  isCreating,
}: CreateChannelDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  const activeProfiles = profiles.filter((p) => p.is_active !== false);
  const filteredProfiles = searchTerm
    ? activeProfiles.filter((p) =>
        p.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : activeProfiles;

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedMembers(new Set(activeProfiles.map((p) => p.id)));
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await onCreateChannel({
      name: name.trim(),
      description: description.trim(),
      memberIds: [...selectedMembers],
    });
    // Reset form
    setName("");
    setDescription("");
    setSelectedMembers(new Set());
    setSearchTerm("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Hash className="w-4 h-4 text-primary" />
            </div>
            Create Channel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Channel Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Channel Name
            </label>
            <div className="relative">
              <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                placeholder="e.g. production-updates"
                className="pl-8 text-sm"
                autoFocus
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Description (optional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              className="text-sm resize-none"
              rows={2}
            />
          </div>

          {/* Members */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                Add Members ({selectedMembers.size})
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-primary"
                onClick={selectAll}
              >
                Select All
              </Button>
            </div>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search members..."
              className="h-8 text-xs"
            />
            <ScrollArea className="h-40 rounded-lg border border-border">
              <div className="p-1 space-y-0.5">
                {filteredProfiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => toggleMember(p.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left",
                      selectedMembers.has(p.id)
                        ? "bg-primary/10"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={selectedMembers.has(p.id)}
                      className="pointer-events-none"
                    />
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={p.avatar_url || ""} />
                      <AvatarFallback
                        className={cn(
                          "text-[9px] font-bold text-white",
                          getAvatarColor(p.full_name)
                        )}
                      >
                        {getInitials(p.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-foreground flex-1 truncate">
                      {p.full_name}
                    </span>
                    {p.preferred_language && p.preferred_language !== "en" && (
                      <span className="text-[9px] text-muted-foreground">
                        {p.preferred_language.toUpperCase()}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim() || isCreating}
            className="gap-1.5"
          >
            {isCreating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Hash className="w-3.5 h-3.5" />
            )}
            Create Channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
