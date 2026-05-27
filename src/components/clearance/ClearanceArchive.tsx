import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { CalendarIcon, X, Archive as ArchiveIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useClearanceArchive, ArchiveRow } from "@/hooks/useClearanceArchive";
import { ArchiveCard } from "./ArchiveCard";

const PAGE = 50;

export function ClearanceArchive() {
  const today = useMemo(() => new Date(), []);
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(today, 30));
  const [toDate, setToDate] = useState<Date | undefined>(today);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [cutPlanId, setCutPlanId] = useState<string | null>(null);
  const [verifiedBy, setVerifiedBy] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [lightbox, setLightbox] = useState<{
    tag: string | null;
    product: string | null;
    row: ArchiveRow;
  } | null>(null);

  const { data, isLoading, error } = useClearanceArchive(
    {
      projectId,
      cutPlanId,
      verifiedBy,
      fromDate: fromDate ? fromDate.toISOString() : null,
      toDate: toDate
        ? new Date(
            toDate.getFullYear(),
            toDate.getMonth(),
            toDate.getDate(),
            23,
            59,
            59
          ).toISOString()
        : null,
    },
    limit
  );

  const rows = data || [];

  // Build distinct option lists from current result set
  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.project_id) {
        map.set(
          r.project_id,
          [r.customer_name, r.project_name].filter(Boolean).join(" / ") || r.project_id
        );
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const manifests = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!r.cut_plan_id) continue;
      if (projectId && r.project_id !== projectId) continue;
      map.set(r.cut_plan_id, r.manifest_label || r.cut_plan_id);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, projectId]);

  const operators = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.verified_by) map.set(r.verified_by, r.verified_by_name || "Unknown");
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const clearAll = () => {
    setProjectId(null);
    setCutPlanId(null);
    setVerifiedBy(null);
    setFromDate(subDays(today, 30));
    setToDate(today);
    setLimit(PAGE);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-2">
        <DateButton label="From" value={fromDate} onChange={setFromDate} />
        <DateButton label="To" value={toDate} onChange={setToDate} />

        <Select
          value={projectId || "__all__"}
          onValueChange={(v) => {
            setProjectId(v === "__all__" ? null : v);
            setCutPlanId(null);
          }}
        >
          <SelectTrigger className="w-[200px] h-9 text-xs">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All projects</SelectItem>
            {projects.map(([id, label]) => (
              <SelectItem key={id} value={id}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={cutPlanId || "__all__"}
          onValueChange={(v) => setCutPlanId(v === "__all__" ? null : v)}
        >
          <SelectTrigger className="w-[200px] h-9 text-xs">
            <SelectValue placeholder="Manifest" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All manifests</SelectItem>
            {manifests.map(([id, label]) => (
              <SelectItem key={id} value={id}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={verifiedBy || "__all__"}
          onValueChange={(v) => setVerifiedBy(v === "__all__" ? null : v)}
        >
          <SelectTrigger className="w-[180px] h-9 text-xs">
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All operators</SelectItem>
            {operators.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 gap-1">
          <X className="w-3.5 h-3.5" /> Reset
        </Button>

        <Badge variant="outline" className="ml-auto gap-1.5 text-xs">
          <ArchiveIcon className="w-3.5 h-3.5" />
          {rows.length} cleared
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive text-sm">
          Failed to load archive
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ArchiveIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No cleared items match these filters</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((r) => (
              <ArchiveCard key={r.evidence_id} row={r} onOpen={setLightbox} />
            ))}
          </div>
          {rows.length >= limit && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setLimit(limit + PAGE)}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl">
          <DialogTitle className="text-sm font-bold tracking-wider uppercase">
            {lightbox?.row.mark_number || lightbox?.row.bar_code} ·{" "}
            {lightbox?.row.manifest_label}
          </DialogTitle>
          {lightbox && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <LightboxImg label="TAG" url={lightbox.tag} />
              <LightboxImg label="PRODUCT" url={lightbox.product} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DateButton({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-2 text-xs justify-start",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          {label}: {value ? format(value, "MMM d, yyyy") : "—"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

function LightboxImg({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="relative rounded-lg overflow-hidden bg-muted/40 aspect-square">
      {url ? (
        <img src={url} alt={label} className="w-full h-full object-contain" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs uppercase tracking-wider">
          Missing
        </div>
      )}
      <span className="absolute top-2 left-2 text-[10px] font-bold tracking-wider uppercase bg-background/80 text-foreground px-2 py-0.5 rounded">
        {label}
      </span>
    </div>
  );
}
