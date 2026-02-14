import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { UserPlus, Check } from "lucide-react";
import { useProfiles } from "@/hooks/useProfiles";
import { cn } from "@/lib/utils";

interface AssignPopoverProps {
  assignedTo: string | null;
  onAssign: (profileId: string) => void;
}

export function AssignPopover({ assignedTo, onAssign }: AssignPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { profiles } = useProfiles();

  const filtered = profiles.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const assignedProfile = assignedTo
    ? profiles.find((p) => p.id === assignedTo)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
          <UserPlus className="w-3 h-3" />
          {assignedProfile ? assignedProfile.full_name : "Assign"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <Input
          placeholder="Search team…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs mb-2"
        />
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No matches</p>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onAssign(p.id);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent flex items-center justify-between",
                assignedTo === p.id && "bg-accent"
              )}
            >
              <span className="truncate">{p.full_name}</span>
              {assignedTo === p.id && <Check className="w-3 h-3 shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
