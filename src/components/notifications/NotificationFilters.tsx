import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface Props {
  search: string;
  onSearchChange: (val: string) => void;
  priorityFilter: string;
  onPriorityChange: (val: string) => void;
}

export function NotificationFilters({ search, onSearchChange, priorityFilter, onPriorityChange }: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search notifications..."
          className="h-7 text-xs pl-7"
        />
      </div>
      <Select value={priorityFilter} onValueChange={onPriorityChange}>
        <SelectTrigger className="w-24 h-7 text-xs">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="normal">Normal</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
