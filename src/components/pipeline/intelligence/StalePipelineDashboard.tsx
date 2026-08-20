import { useMemo, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads"> & { customers: { name: string; company_name: string | null } | null };

interface Props {
  leads: Lead[];
  isLoading: boolean;
}

const TERMINAL = new Set(["won", "lost", "loss", "merged", "delivered_pickup_done", "archived_orphan", "no_rebars_out_of_scope"]);

interface StaleLead {
  id: string;
  title: string;
  stage: string;
  owner: string | null;
  value: number;
  daysSince: number;
  updatedAt: string;
}

function bucketLeads(leads: Lead[], minDays: number, maxDays: number | null): StaleLead[] {
  const now = new Date();
  return leads
    .filter((l) => !TERMINAL.has(l.stage))
    .map((l) => {
      const days = differenceInCalendarDays(now, new Date(l.updated_at));
      return { lead: l, days };
    })
    .filter(({ days }) => days >= minDays && (maxDays === null || days < maxDays))
    .sort((a, b) => (b.lead.expected_value ?? 0) - (a.lead.expected_value ?? 0))
    .map(({ lead, days }) => ({
      id: lead.id,
      title: lead.title ?? "Untitled",
      stage: lead.stage,
      owner: lead.assigned_to ?? null,
      value: lead.expected_value ?? 0,
      daysSince: days,
      updatedAt: lead.updated_at,
    }));
}

function BucketSummary({ label, leads, color }: { label: string; leads: StaleLead[]; color: string }) {
  const totalValue = leads.reduce((s, l) => s + l.value, 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${color}`} />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{leads.length}</div>
        <p className="text-xs text-muted-foreground">
          ${totalValue.toLocaleString()} at risk
        </p>
      </CardContent>
    </Card>
  );
}

function LeadTable({ leads }: { leads: StaleLead[] }) {
  const navigate = useNavigate();
  if (leads.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No stale leads in this bucket 🎉</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead className="text-right">Days Stale</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((l) => (
          <TableRow key={l.id}>
            <TableCell className="font-medium max-w-[200px] truncate">{l.title}</TableCell>
            <TableCell><Badge variant="outline" className="text-xs">{l.stage}</Badge></TableCell>
            <TableCell className="text-xs">{l.owner ?? "—"}</TableCell>
            <TableCell className="text-right">${l.value.toLocaleString()}</TableCell>
            <TableCell className="text-right font-semibold">{l.daysSince}d</TableCell>
            <TableCell>
              <Button size="sm" variant="ghost" onClick={() => navigate(`/pipeline?lead=${l.id}`)}>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function StalePipelineDashboard({ leads, isLoading }: Props) {
  const [view, setView] = useState("by-bucket");

  const bucket7 = useMemo(() => bucketLeads(leads, 7, 14), [leads]);
  const bucket14 = useMemo(() => bucketLeads(leads, 14, 30), [leads]);
  const bucket30 = useMemo(() => bucketLeads(leads, 30, null), [leads]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <BucketSummary label="7–14 days" leads={bucket7} color="text-amber-500" />
        <BucketSummary label="14–30 days" leads={bucket14} color="text-orange-500" />
        <BucketSummary label="30+ days" leads={bucket30} color="text-destructive" />
      </div>

      {/* Detail tables */}
      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="by-bucket">By Staleness</TabsTrigger>
          <TabsTrigger value="by-owner">By Owner</TabsTrigger>
        </TabsList>
        <TabsContent value="by-bucket" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-500" /> 7–14 Days ({bucket7.length})</CardTitle></CardHeader>
            <CardContent><LeadTable leads={bucket7} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-orange-500" /> 14–30 Days ({bucket14.length})</CardTitle></CardHeader>
            <CardContent><LeadTable leads={bucket14} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-destructive" /> 30+ Days ({bucket30.length})</CardTitle></CardHeader>
            <CardContent><LeadTable leads={bucket30} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="by-owner" className="mt-4">
          <ByOwnerView leads={[...bucket7, ...bucket14, ...bucket30]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ByOwnerView({ leads }: { leads: StaleLead[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, StaleLead[]>();
    leads.forEach((l) => {
      const key = l.owner ?? "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const aVal = a[1].reduce((s, l) => s + l.value, 0);
      const bVal = b[1].reduce((s, l) => s + l.value, 0);
      return bVal - aVal;
    });
  }, [leads]);

  return (
    <div className="space-y-4">
      {grouped.map(([owner, ownerLeads]) => (
        <Card key={owner}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{owner} ({ownerLeads.length} stale leads — ${ownerLeads.reduce((s, l) => s + l.value, 0).toLocaleString()})</CardTitle>
          </CardHeader>
          <CardContent><LeadTable leads={ownerLeads} /></CardContent>
        </Card>
      ))}
    </div>
  );
}
