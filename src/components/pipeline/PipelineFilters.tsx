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
  Search,
} from "lucide-react";
import { PIPELINE_STAGES } from "@/pages/Pipeline";
import {
  FilterToggle,
  FilterChip,
  FieldFilter,
  DateFilterDropdown,
} from "@/components/ui/filter-popover";

// ── Types ──

export interface PipelineFilterState {
  myPipeline: boolean;
  unassigned: boolean;
  openOpportunities: boolean;
  won: boolean;
  lost: boolean;
  archived: boolean;
  salesperson: string | null;
  stage: string | null;
  source: string | null;
  creationDateRange: string | null;
  closedDateRange: string | null;
}

export const DEFAULT_FILTERS: PipelineFilterState = {
  myPipeline: false,
  unassigned: false,
  openOpportunities: false,
  won: false,
  lost: false,
  archived: false,
  salesperson: null,
  stage: null,
  source: null,
  creationDateRange: null,
  closedDateRange: null,
};

export type GroupByOption =
  | "none"
  | "salesperson"
  | "stage"
  | "source"
  | "creation_date"
  | "expected_closing";

interface SavedFilter {
  id: string;
  label: string;
  filters: PipelineFilterState;
}

interface PipelineFiltersProps {
  filters: PipelineFilterState;
  onFiltersChange: (f: PipelineFilterState) => void;
  groupBy: GroupByOption;
  onGroupByChange: (g: GroupByOption) => void;
  salespersons: string[];
  sources: string[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

function activeFilterCount(f: PipelineFilterState): number {
  let c = 0;
  if (f.myPipeline) c++;
  if (f.unassigned) c++;
  if (f.openOpportunities) c++;
  if (f.won) c++;
  if (f.lost) c++;
  if (f.archived) c++;
  if (f.salesperson) c++;
  if (f.stage) c++;
  if (f.source) c++;
  if (f.creationDateRange) c++;
  if (f.closedDateRange) c++;
  return c;
}

// ── Component ──

export function PipelineFilters({
  filters,
  onFiltersChange,
  groupBy,
  onGroupByChange,
  salespersons,
  sources,
  searchQuery,
  onSearchChange,
}: PipelineFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const count = activeFilterCount(filters);

  const toggle = (key: keyof PipelineFilterState, value?: unknown) => {
    const next = { ...filters };
    if (typeof value !== "undefined") {
      (next as any)[key] = value;
    } else {
      (next as any)[key] = !(next as any)[key];
    }
    onFiltersChange(next);
  };

  const clearAll = () => {
    onFiltersChange({ ...DEFAULT_FILTERS });
    onGroupByChange("none");
  };

  // ── Saved filters (localStorage) ──
  const STORAGE_KEY = "pipeline_saved_filters";
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
    <div className="space-y-1.5">
      {/* Odoo-style search bar */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center border border-border rounded-md bg-background h-9">
          <Search className="w-4 h-4 text-muted-foreground ml-3 shrink-0" />
          <input
            type="text"
            placeholder="Search leads, customers, source..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm px-2.5 h-full text-foreground placeholder:text-muted-foreground"
          />
          {count > 0 && (
            <div className="flex items-center gap-1 px-1 overflow-x-auto">
              {filters.myPipeline && <FilterChip label="My Pipeline" onRemove={() => toggle("myPipeline")} />}
              {filters.unassigned && <FilterChip label="Unassigned" onRemove={() => toggle("unassigned")} />}
              {filters.openOpportunities && <FilterChip label="Open" onRemove={() => toggle("openOpportunities")} />}
              {filters.won && <FilterChip label="Won" onRemove={() => toggle("won")} />}
              {filters.lost && <FilterChip label="Lost" onRemove={() => toggle("lost")} />}
              {filters.salesperson && <FilterChip label={`SP: ${filters.salesperson}`} onRemove={() => toggle("salesperson", null)} />}
              {filters.stage && <FilterChip label={`Stage: ${filters.stage}`} onRemove={() => toggle("stage", null)} />}
              {filters.source && <FilterChip label={`Source: ${filters.source}`} onRemove={() => toggle("source", null)} />}
              {filters.creationDateRange && <FilterChip label={`Created: ${filters.creationDateRange}`} onRemove={() => toggle("creationDateRange", null)} />}
              {filters.closedDateRange && <FilterChip label={`Closed: ${filters.closedDateRange}`} onRemove={() => toggle("closedDateRange", null)} />}
              {groupBy !== "none" && <FilterChip label={`Group: ${groupBy}`} onRemove={() => onGroupByChange("none")} />}
            </div>
          )}
          <PopoverTrigger asChild>
            <button
              className="flex items-center justify-center h-full px-2.5 border-l border-border hover:bg-accent transition-colors shrink-0"
              title="Filters & Group By"
            >
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
          </PopoverTrigger>
        </div>

        <PopoverContent
          className="w-[640px] p-0"
          align="end"
          sideOffset={4}
        >
          <div className="grid grid-cols-3 divide-x divide-border">
            {/* ── Column 1: Filters ── */}
            <div className="p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1 flex items-center gap-1.5">
                <Filter className="w-3 h-3" /> Filters
              </p>
              <FilterToggle label="My Pipeline" active={filters.myPipeline} onClick={() => toggle("myPipeline")} />
              <FilterToggle label="Unassigned" active={filters.unassigned} onClick={() => toggle("unassigned")} />
              <FilterToggle label="Open Opportunities" active={filters.openOpportunities} onClick={() => toggle("openOpportunities")} />

              <Separator className="my-1.5" />

              <DateFilterDropdown
                label="Creation Date"
                value={filters.creationDateRange}
                onChange={(v) => toggle("creationDateRange", v)}
              />
              <DateFilterDropdown
                label="Closed Date"
                value={filters.closedDateRange}
                onChange={(v) => toggle("closedDateRange", v)}
              />

              <Separator className="my-1.5" />

              <FilterToggle label="Won" active={filters.won} onClick={() => toggle("won")} />
              <FilterToggle label="Lost" active={filters.lost} onClick={() => toggle("lost")} />
              <FilterToggle label="Archived" active={filters.archived} onClick={() => toggle("archived")} />
            </div>

            {/* ── Column 2: Group By ── */}
            <div className="p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1 flex items-center gap-1.5">
                <Layers className="w-3 h-3" /> Group By
              </p>
              <FilterToggle label="Salesperson" active={groupBy === "salesperson"} onClick={() => onGroupByChange(groupBy === "salesperson" ? "none" : "salesperson")} />
              <FilterToggle label="Stage" active={groupBy === "stage"} onClick={() => onGroupByChange(groupBy === "stage" ? "none" : "stage")} />
              <FilterToggle label="Source" active={groupBy === "source"} onClick={() => onGroupByChange(groupBy === "source" ? "none" : "source")} />

              <Separator className="my-1.5" />

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1 pt-1">
                By Field
              </p>

              <FieldFilter
                label="Salesperson"
                value={filters.salesperson}
                options={salespersons}
                onChange={(v) => toggle("salesperson", v)}
              />
              <FieldFilter
                label="Stage"
                value={filters.stage}
                options={PIPELINE_STAGES.map((s) => s.label)}
                onChange={(v) => toggle("stage", v)}
              />
              <FieldFilter
                label="Source"
                value={filters.source}
                options={sources.filter((s) => !s.startsWith("Email:")).slice(0, 10)}
                onChange={(v) => toggle("source", v)}
              />
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
          {count > 0 && (
            <div className="border-t border-border px-3 py-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs gap-1.5 h-7">
                <X className="w-3 h-3" /> Clear all
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
