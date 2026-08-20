import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { X, Plus, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/hooks/useProfiles";

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-purple-500",
  "bg-pink-500", "bg-teal-500", "bg-red-500", "bg-amber-500",
  "bg-cyan-500", "bg-indigo-500",
];

function getNameColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

interface AssigneeChip {
  profile_id: string;
  full_name: string;
}

interface AssigneeManagerProps {
  assignees: AssigneeChip[];
  profiles: Profile[];
  onAdd: (profileId: string) => void;
  onRemove: (profileId: string) => void;
  readOnly?: boolean;
}

export function AssigneeManager({ assignees, profiles, onAdd, onRemove, readOnly }: AssigneeManagerProps) {
  const [open, setOpen] = useState(false);
  const assignedIds = new Set(assignees.map(a => a.profile_id));
  const available = profiles.filter(p => !assignedIds.has(p.id));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 flex-wrap">
        {assignees.map((a) => (
          <span
            key={a.profile_id}
            className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-sm bg-muted border border-border"
          >
            <span className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0", getNameColor(a.full_name))}>
              {getInitials(a.full_name)}
            </span>
            <span className="truncate max-w-[100px]">{a.full_name}</span>
            {!readOnly && (
              <button onClick={() => onRemove(a.profile_id)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        {!readOnly && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                <UserPlus className="w-3 h-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search..." />
                <CommandList>
                  <CommandEmpty>No members available.</CommandEmpty>
                  {available.map(p => (
                    <CommandItem
                      key={p.id}
                      value={p.full_name}
                      onSelect={() => { onAdd(p.id); setOpen(false); }}
                    >
                      <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white mr-2", getNameColor(p.full_name))}>
                        {getInitials(p.full_name)}
                      </span>
                      {p.full_name}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
      {assignees.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No assignees</p>
      )}
    </div>
  );
}

/** Compact stacked avatars for LeadCard display */
export function AssigneeAvatars({ assignees, max = 3 }: { assignees: AssigneeChip[]; max?: number }) {
  if (assignees.length === 0) return null;
  const shown = assignees.slice(0, max);
  const overflow = assignees.length - max;

  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((a) => (
        <div
          key={a.profile_id}
          className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ring-1 ring-background", getNameColor(a.full_name))}
          title={a.full_name}
        >
          {getInitials(a.full_name)}
        </div>
      ))}
      {overflow > 0 && (
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold bg-muted text-muted-foreground shrink-0 ring-1 ring-background">
          +{overflow}
        </div>
      )}
    </div>
  );
}
