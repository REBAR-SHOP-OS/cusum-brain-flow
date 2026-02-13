import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Filter,
  ChevronDown,
  Star,
  Bookmark,
  X,
  Layers,
} from "lucide-react";
import {
  FilterToggle,
  FilterChip,
  FieldFilter,
} from "@/components/ui/filter-popover";

// ── Types ──

export interface ProspectingFilterState {
  statusPending: boolean;
  statusApproved: boolean;
  statusRejected: boolean;
  statusEmailed: boolean;
  industry: string | null;
  city: string | null;
}

export const DEFAULT_PROSPECT_FILTERS: ProspectingFilterState = {
  statusPending: false,
  statusApproved: false,
  statusRejected: false,
  statusEmailed: false,
  industry: null,
  city: null,
};

export type ProspectGroupByOption =
  | "none"
  | "status"
  | "industry"
  | "city";

interface SavedFilter {
  id: string;
  label: string;
  filters: ProspectingFilterState;
}

interface ProspectingFiltersProps {
  filters: ProspectingFilterState;
  onFiltersChange: (f: ProspectingFilterState) => void;
  groupBy: ProspectGroupByOption;
  onGroupByChange: (g: ProspectGroupByOption) => void;
  industries: string[];
  cities: string[];
}

function activeFilterCount(f: ProspectingFilterState): number {
  let c = 0;
  if (f.statusPending) c++;
  if (f.statusApproved) c++;
  if (f.statusRejected) c++;
  if (f.statusEmailed) c++;
  if (f.industry) c++;
  if (f.city) c++;
  return c;
}

// ── Component ──

export function ProspectingFilters({
  filters,
  onFiltersChange,
  groupBy,
  onGroupByChange,
  industries,
  cities,
}: ProspectingFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const count = activeFilterCount(filters);

  const toggle = (key: keyof ProspectingFilterState, value?: unknown) => {
    const next = { ...filters };
    if (typeof value !== "undefined") {
      (next as any)[key] = value;
    } else {
      (next as any)[key] = !(next as any)[key];
    }
    onFiltersChange(next);
  };

  const clearAll = () => {
    onFiltersChange({ ...DEFAULT_PROSPECT_FILTERS });
    onGroupByChange("none");
  };

  // ── Saved filters (localStorage) ──
  const STORAGE_KEY = "prospecting_saved_filters";
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const saveCurrentFilter = () => {
    const label = prompt("Filter name:");
    if (!label) return;
    const updated = [
      ...savedFilters,
      { id: crypto.randomUUID(), label, filters: { ...filters } },
    ];
    setSavedFilters(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const deleteSavedFilter = (id: string) => {
    const updated = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const applySavedFilter = (sf: SavedFilter) => {
    onFiltersChange({ ...sf.filters });
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 h-8">
            <Filter className="w-3.5 h-3.5" />
            Filters
            {count > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px] min-w-[16px] justify-center">
                {count}
              </Badge>
            )}
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[640px] p-0"
          align="start"
          sideOffset={6}
        >
          <div className="grid grid-cols-3 divide-x divide-border">
            {/* ── Column 1: Filters ── */}
            <div className="p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1 flex items-center gap-1.5">
                <Filter className="w-3 h-3" /> Filters
              </p>
              <FilterToggle label="Pending" active={filters.statusPending} onClick={() => toggle("statusPending")} />
              <FilterToggle label="Approved" active={filters.statusApproved} onClick={() => toggle("statusApproved")} />
              <FilterToggle label="Rejected" active={filters.statusRejected} onClick={() => toggle("statusRejected")} />
              <FilterToggle label="Emailed" active={filters.statusEmailed} onClick={() => toggle("statusEmailed")} />

              <Separator className="my-1.5" />

              <FieldFilter
                label="Industry"
                value={filters.industry}
                options={industries}
                onChange={(v) => toggle("industry", v)}
              />
              <FieldFilter
                label="City"
                value={filters.city}
                options={cities}
                onChange={(v) => toggle("city", v)}
              />
            </div>

            {/* ── Column 2: Group By ── */}
            <div className="p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1 flex items-center gap-1.5">
                <Layers className="w-3 h-3" /> Group By
              </p>
              <FilterToggle label="Status" active={groupBy === "status"} onClick={() => onGroupByChange(groupBy === "status" ? "none" : "status")} />
              <FilterToggle label="Industry" active={groupBy === "industry"} onClick={() => onGroupByChange(groupBy === "industry" ? "none" : "industry")} />
              <FilterToggle label="City" active={groupBy === "city"} onClick={() => onGroupByChange(groupBy === "city" ? "none" : "city")} />
            </div>

            {/* ── Column 3: Favorites ── */}
            <div className="p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1 flex items-center gap-1.5">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> Favorites
              </p>

              {savedFilters.map((sf) => (
                <div
                  key={sf.id}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm group"
                  onClick={() => applySavedFilter(sf)}
                >
                  <Bookmark className="w-3 h-3 text-muted-foreground" />
                  <span className="flex-1 truncate">{sf.label}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSavedFilter(sf.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5"
                  >
                    <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}

              <button
                onClick={saveCurrentFilter}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-accent text-sm text-muted-foreground w-full"
              >
                <Star className="w-3 h-3" />
                Save current search
              </button>
            </div>
          </div>

          {/* Footer */}
          {(count > 0 || groupBy !== "none") && (
            <div className="border-t border-border px-3 py-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs gap-1.5 h-7">
                <X className="w-3 h-3" /> Clear all
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Active filter chips */}
      {(count > 0 || groupBy !== "none") && (
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {filters.statusPending && <FilterChip label="Pending" onRemove={() => toggle("statusPending")} />}
          {filters.statusApproved && <FilterChip label="Approved" onRemove={() => toggle("statusApproved")} />}
          {filters.statusRejected && <FilterChip label="Rejected" onRemove={() => toggle("statusRejected")} />}
          {filters.statusEmailed && <FilterChip label="Emailed" onRemove={() => toggle("statusEmailed")} />}
          {filters.industry && <FilterChip label={`Industry: ${filters.industry}`} onRemove={() => toggle("industry", null)} />}
          {filters.city && <FilterChip label={`City: ${filters.city}`} onRemove={() => toggle("city", null)} />}
          {groupBy !== "none" && <FilterChip label={`Group: ${groupBy}`} onRemove={() => onGroupByChange("none")} />}
        </div>
      )}
    </div>
  );
}
