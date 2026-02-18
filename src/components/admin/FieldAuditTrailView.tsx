import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, ArrowRight } from "lucide-react";
import { format } from "date-fns";

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
}

const tableColors: Record<string, string> = {
  orders: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  leads: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  customers: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  profiles: "bg-green-500/10 text-green-600 dark:text-green-400",
};

export function FieldAuditTrailView() {
  const [tableFilter, setTableFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["field-audit-trail", tableFilter],
    queryFn: async () => {
      let q = supabase
        .from("field_audit_trail")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(200);
      if (tableFilter !== "all") {
        q = q.eq("table_name", tableFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as AuditEntry[];
    },
  });

  const filtered = search
    ? entries.filter(
        (e) =>
          e.field_name.toLowerCase().includes(search.toLowerCase()) ||
          e.record_id.toLowerCase().includes(search.toLowerCase()) ||
          (e.old_value || "").toLowerCase().includes(search.toLowerCase()) ||
          (e.new_value || "").toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  const truncate = (val: string | null, len = 40) => {
    if (!val) return "—";
    return val.length > len ? val.slice(0, len) + "…" : val;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h2 className="text-xl font-bold">Field Audit Trail</h2>
        <p className="text-sm text-muted-foreground">Per-field change log for orders, leads, customers, and profiles.</p>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search field, value, record..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={tableFilter} onValueChange={setTableFilter}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tables</SelectItem>
            <SelectItem value="orders">Orders</SelectItem>
            <SelectItem value="leads">Leads</SelectItem>
            <SelectItem value="customers">Customers</SelectItem>
            <SelectItem value="profiles">Profiles</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No audit entries found.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[100px_140px_140px_1fr_1fr_140px] gap-2 px-4 py-2 bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
            <span>Table</span>
            <span>Field</span>
            <span>Record</span>
            <span>Old → New</span>
            <span></span>
            <span>When</span>
          </div>
          <ScrollArea className="max-h-[600px]">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[100px_140px_140px_1fr_1fr_140px] gap-2 px-4 py-2.5 border-b border-border last:border-0 hover:bg-accent/30 text-sm items-center"
              >
                <Badge variant="secondary" className={`text-[10px] px-1.5 w-fit ${tableColors[entry.table_name] || ""}`}>
                  {entry.table_name}
                </Badge>
                <span className="font-mono text-xs truncate">{entry.field_name}</span>
                <span className="font-mono text-[11px] text-muted-foreground truncate">{entry.record_id.slice(0, 8)}…</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-destructive/80 truncate">{truncate(entry.old_value)}</span>
                  <ArrowRight className="w-3 h-3 shrink-0 text-muted-foreground" />
                  <span className="text-xs text-green-600 dark:text-green-400 truncate">{truncate(entry.new_value)}</span>
                </div>
                <span></span>
                <span className="text-[11px] text-muted-foreground">
                  {format(new Date(entry.changed_at), "MMM d, HH:mm")}
                </span>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
