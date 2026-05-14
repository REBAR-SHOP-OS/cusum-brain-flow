import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DollarSign, AlertTriangle, Download, CalendarIcon } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  is_active?: boolean;
}

interface WeeklySummary {
  id: string;
  profile_id: string;
  employee_type: string;
  regular_hours: number;
  overtime_hours: number;
  total_paid_hours: number;
  total_exceptions: number;
  status: string;
  week_start: string;
  week_end: string;
}

interface PayrollSummaryTabProps {
  isAdmin: boolean;
  myProfile: Profile | null;
  profiles: Profile[];
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-green-500/15 text-green-600",
  locked: "bg-primary/15 text-primary",
};

interface RawPunch {
  id: string;
  profile_id: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number | null;
}

export function PayrollSummaryTab({ isAdmin, myProfile, profiles }: PayrollSummaryTabProps) {
  const [summaries, setSummaries] = useState<WeeklySummary[]>([]);
  const [punches, setPunches] = useState<RawPunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  const now = new Date();
  const [rangeStart, setRangeStart] = useState<Date>(startOfWeek(now, { weekStartsOn: 1 }));
  const [rangeEnd, setRangeEnd] = useState<Date>(endOfWeek(now, { weekStartsOn: 1 }));

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const wsStr = format(rangeStart, "yyyy-MM-dd");
      const weStr = format(rangeEnd, "yyyy-MM-dd");

      let query = supabase
        .from("payroll_weekly_summary")
        .select("*")
        .gte("week_start", wsStr)
        .lte("week_start", weStr)
        .order("week_start", { ascending: false });

      if (!isAdmin && myProfile) {
        query = query.eq("profile_id", myProfile.id);
      }

      const { data, error } = await query;
      const summaryRows = (!error && data ? (data as WeeklySummary[]) : []);
      setSummaries(summaryRows);

      // Fallback: if no computed summary exists, aggregate raw punches in range
      if (summaryRows.length === 0) {
        const startIso = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), 0, 0, 0).toISOString();
        const endIso = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59).toISOString();
        let pq = supabase
          .from("time_clock_entries")
          .select("id, profile_id, clock_in, clock_out, break_minutes")
          .gte("clock_in", startIso)
          .lte("clock_in", endIso)
          .order("clock_in", { ascending: false });
        if (!isAdmin && myProfile) pq = pq.eq("profile_id", myProfile.id);
        const { data: pdata } = await pq;
        setPunches((pdata as RawPunch[]) || []);
        setUsingFallback(true);
      } else {
        setPunches([]);
        setUsingFallback(false);
      }
      setLoading(false);
    }
    fetch();
  }, [isAdmin, myProfile?.id, rangeStart, rangeEnd]);

  // Aggregate raw punches per profile when fallback active
  const punchAggregated = useMemo(() => {
    if (!usingFallback) return [];
    const map = new Map<string, {
      profile_id: string;
      employee_type: string;
      regular_hours: number;
      overtime_hours: number;
      total_paid_hours: number;
      total_exceptions: number;
      weeks: number;
      latestStatus: string;
    }>();
    for (const p of punches) {
      if (!p.clock_out) continue;
      const mins = (new Date(p.clock_out).getTime() - new Date(p.clock_in).getTime()) / 60000 - (p.break_minutes || 0);
      if (mins <= 0) continue;
      const hrs = mins / 60;
      const existing = map.get(p.profile_id);
      if (existing) {
        existing.total_paid_hours += hrs;
        existing.regular_hours += hrs;
      } else {
        map.set(p.profile_id, {
          profile_id: p.profile_id,
          employee_type: "raw",
          regular_hours: hrs,
          overtime_hours: 0,
          total_paid_hours: hrs,
          total_exceptions: 0,
          weeks: 0,
          latestStatus: "raw",
        });
      }
    }
    // Count open shifts as exceptions
    for (const p of punches) {
      if (!p.clock_out) {
        const e = map.get(p.profile_id);
        if (e) e.total_exceptions += 1;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total_paid_hours - a.total_paid_hours);
  }, [punches, usingFallback]);

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  // Aggregate by employee across the date range
  const aggregated = useMemo(() => {
    const map = new Map<string, {
      profile_id: string;
      employee_type: string;
      regular_hours: number;
      overtime_hours: number;
      total_paid_hours: number;
      total_exceptions: number;
      weeks: number;
      latestStatus: string;
    }>();
    for (const s of summaries) {
      const existing = map.get(s.profile_id);
      if (existing) {
        existing.regular_hours += Number(s.regular_hours) || 0;
        existing.overtime_hours += Number(s.overtime_hours) || 0;
        existing.total_paid_hours += Number(s.total_paid_hours) || 0;
        existing.total_exceptions += Number(s.total_exceptions) || 0;
        existing.weeks += 1;
      } else {
        map.set(s.profile_id, {
          profile_id: s.profile_id,
          employee_type: s.employee_type,
          regular_hours: Number(s.regular_hours) || 0,
          overtime_hours: Number(s.overtime_hours) || 0,
          total_paid_hours: Number(s.total_paid_hours) || 0,
          total_exceptions: Number(s.total_exceptions) || 0,
          weeks: 1,
          latestStatus: s.status,
        });
      }
    }
    return Array.from(map.values());
  }, [summaries]);

  const setPreset = (preset: "this_week" | "last_week" | "last_4_weeks" | "ytd") => {
    const today = new Date();
    if (preset === "this_week") {
      setRangeStart(startOfWeek(today, { weekStartsOn: 1 }));
      setRangeEnd(endOfWeek(today, { weekStartsOn: 1 }));
    } else if (preset === "last_week") {
      const lw = new Date(today); lw.setDate(lw.getDate() - 7);
      setRangeStart(startOfWeek(lw, { weekStartsOn: 1 }));
      setRangeEnd(endOfWeek(lw, { weekStartsOn: 1 }));
    } else if (preset === "last_4_weeks") {
      const s = new Date(today); s.setDate(s.getDate() - 28);
      setRangeStart(startOfWeek(s, { weekStartsOn: 1 }));
      setRangeEnd(endOfWeek(today, { weekStartsOn: 1 }));
    } else {
      setRangeStart(new Date(today.getFullYear(), 0, 1));
      setRangeEnd(endOfWeek(today, { weekStartsOn: 1 }));
    }
  };

  const exportCsv = () => {
    if (summaries.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const header = [
      "Employee", "Employee Type", "Week Start", "Week End",
      "Regular Hours", "Overtime Hours", "Total Paid Hours", "Exceptions", "Status",
    ];
    const rows = summaries.map((s) => {
      const name = profileMap.get(s.profile_id)?.full_name || "Unknown";
      return [
        name, s.employee_type, s.week_start, s.week_end,
        s.regular_hours, s.overtime_hours, s.total_paid_hours, s.total_exceptions, s.status,
      ];
    });
    const csv = [header, ...rows]
      .map((r) => r.map((v) => {
        const str = String(v ?? "");
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_${format(rangeStart, "yyyyMMdd")}_${format(rangeEnd, "yyyyMMdd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Export downloaded");
  };

  return (
    <div className="space-y-3">
      {/* Toolbar: range + presets + export */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
              From: {format(rangeStart, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={rangeStart}
              onSelect={(d) => d && setRangeStart(d)}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
              To: {format(rangeEnd, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={rangeEnd}
              onSelect={(d) => d && setRangeEnd(d)}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setPreset("this_week")}>This Week</Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setPreset("last_week")}>Last Week</Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setPreset("last_4_weeks")}>4 Weeks</Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setPreset("ytd")}>YTD</Button>
        </div>

        <div className="flex-1" />

        <Badge variant="secondary" className="text-xs">
          {aggregated.length} employee{aggregated.length !== 1 ? "s" : ""} · {summaries.length} week{summaries.length !== 1 ? "s" : ""}
        </Badge>

        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCsv} disabled={summaries.length === 0}>
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm text-center py-8">Loading payroll data...</p>
      ) : aggregated.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <DollarSign className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No payroll summary in this range.</p>
          <p className="text-xs text-muted-foreground">
            {format(rangeStart, "MMM d, yyyy")} – {format(rangeEnd, "MMM d, yyyy")}
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-480px)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {aggregated.map((s) => {
              const profile = profileMap.get(s.profile_id);
              const name = profile?.full_name || "Unknown";

              return (
                <Card key={s.profile_id} className="transition-colors">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={profile?.avatar_url || ""} />
                        <AvatarFallback className="text-xs font-bold bg-muted text-foreground">
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {s.employee_type} · {s.weeks} week{s.weeks !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <Badge className={cn("text-[10px] uppercase tracking-wider", statusStyles[s.latestStatus] || statusStyles.draft)}>
                        {s.latestStatus}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-lg font-bold text-foreground tabular-nums">{s.regular_hours.toFixed(1)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Regular</p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className={cn("text-lg font-bold tabular-nums", s.overtime_hours > 0 ? "text-orange-500" : "text-foreground")}>
                          {s.overtime_hours.toFixed(1)}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overtime</p>
                      </div>
                      <div className="rounded-md bg-primary/10 p-2">
                        <p className="text-lg font-bold text-primary tabular-nums">{s.total_paid_hours.toFixed(1)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                      </div>
                    </div>

                    {s.total_exceptions > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-orange-500">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {s.total_exceptions} exception{s.total_exceptions !== 1 ? "s" : ""}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
