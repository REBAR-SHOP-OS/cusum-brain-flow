import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInCalendarDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads"> & { customers: { name: string; company_name: string | null } | null };

interface Props {
  leads: Lead[];
  isLoading: boolean;
}

const TERMINAL = new Set(["won", "lost", "loss", "merged", "delivered_pickup_done", "archived_orphan", "no_rebars_out_of_scope"]);

export function UnattendedLeadsDashboard({ leads, isLoading }: Props) {
  const navigate = useNavigate();

  // Fetch all future-dated scheduled activities for open leads
  const { data: leadsWithActivity = new Set<string>() } = useQuery({
    queryKey: ["unattended-leads-activity-check"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("scheduled_activities")
        .select("entity_id")
        .eq("entity_type", "lead")
        .eq("status", "planned")
        .gte("due_date", today);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.entity_id));
    },
    staleTime: 60_000,
  });

  const unattended = useMemo(() => {
    const now = new Date();
    return leads
      .filter((l) => !TERMINAL.has(l.stage) && !leadsWithActivity.has(l.id))
      .map((l) => ({
        id: l.id,
        title: l.title ?? "Untitled",
        stage: l.stage,
        owner: l.assigned_to ?? null,
        value: l.expected_value ?? 0,
        daysSinceCreated: differenceInCalendarDays(now, new Date(l.created_at)),
        daysSinceUpdated: differenceInCalendarDays(now, new Date(l.updated_at)),
      }))
      .sort((a, b) => b.value - a.value);
  }, [leads, leadsWithActivity]);

  const totalValue = unattended.reduce((s, l) => s + l.value, 0);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="py-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              {unattended.length} lead{unattended.length !== 1 ? "s" : ""} ({" "}
              ${totalValue.toLocaleString()} ) have no next step scheduled
            </p>
            <p className="text-xs text-muted-foreground">
              These open leads have zero future-dated activities. Schedule a follow-up to keep them moving.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {unattended.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          All open leads have a next activity scheduled 🎉
        </p>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Unattended Leads — sorted by value</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Days Open</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {unattended.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{l.title}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{l.stage}</Badge></TableCell>
                    <TableCell className="text-xs">{l.owner ?? "—"}</TableCell>
                    <TableCell className="text-right">${l.value.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{l.daysSinceCreated}d</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/pipeline?lead=${l.id}`)}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
