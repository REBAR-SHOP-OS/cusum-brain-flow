import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DollarSign, AlertTriangle, Download, CalendarIcon, ChevronDown, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activePreset, setActivePreset] = useState<"this_week" | "last_week" | "last_4_weeks" | "ytd" | "custom">("this_week");

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
    const fromSummaries = Array.from(map.values());
    return fromSummaries.length > 0 ? fromSummaries : punchAggregated;
  }, [summaries, punchAggregated]);

  const setPreset = (preset: "this_week" | "last_week" | "last_4_weeks" | "ytd") => {
    const today = new Date();
    setActivePreset(preset);
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

  const exportXlsx = () => {
    const hasSummary = summaries.length > 0;
    const hasPunches = punches.length > 0;
    if (aggregated.length === 0 && !hasPunches) {
      toast.error("Nothing to export");
      return;
    }

    const rangeLabel = `${format(rangeStart, "MMM d, yyyy")} – ${format(rangeEnd, "MMM d, yyyy")}`;
    const wb = XLSX.utils.book_new();

    // ---------- Sheet 1: Employee Summary (per-employee totals) ----------
    const summaryAoa: (string | number)[][] = [];
    summaryAoa.push([`Payroll Summary — ${rangeLabel}`]);
    summaryAoa.push([`Generated: ${format(new Date(), "yyyy-MM-dd HH:mm")}`]);
    summaryAoa.push([]);
    summaryAoa.push([
      "Employee", "Type", "Weeks",
      "Regular Hours", "Overtime Hours", "Total Paid Hours",
      "Exceptions", "Status",
    ]);

    let tReg = 0, tOt = 0, tTot = 0, tExc = 0;
    aggregated.forEach((s) => {
      const name = profileMap.get(s.profile_id)?.full_name || "Unknown";
      const reg = Number(s.regular_hours.toFixed(2));
      const ot = Number(s.overtime_hours.toFixed(2));
      const tot = Number(s.total_paid_hours.toFixed(2));
      tReg += reg; tOt += ot; tTot += tot; tExc += s.total_exceptions;
      summaryAoa.push([
        name, s.employee_type, s.weeks,
        reg, ot, tot,
        s.total_exceptions, s.latestStatus,
      ]);
    });
    summaryAoa.push([]);
    summaryAoa.push(["TOTALS", "", "", Number(tReg.toFixed(2)), Number(tOt.toFixed(2)), Number(tTot.toFixed(2)), tExc, ""]);

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
    wsSummary["!cols"] = [
      { wch: 26 }, { wch: 12 }, { wch: 8 },
      { wch: 14 }, { wch: 14 }, { wch: 16 },
      { wch: 12 }, { wch: 12 },
    ];
    wsSummary["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // ---------- Sheet 2: Daily Punches (all employees, sorted) ----------
    if (hasPunches) {
      const punchAoa: (string | number)[][] = [];
      punchAoa.push([`Daily Punches — ${rangeLabel}`]);
      punchAoa.push([]);
      punchAoa.push(["Employee", "Date", "Day", "Clock In", "Clock Out", "Break (min)", "Hours Worked"]);

      const sorted = [...punches].sort((a, b) => {
        const an = profileMap.get(a.profile_id)?.full_name || "";
        const bn = profileMap.get(b.profile_id)?.full_name || "";
        if (an !== bn) return an.localeCompare(bn);
        return new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime();
      });

      sorted.forEach((p) => {
        const name = profileMap.get(p.profile_id)?.full_name || "Unknown";
        const ci = new Date(p.clock_in);
        const co = p.clock_out ? new Date(p.clock_out) : null;
        const hrs = co
          ? Number((((co.getTime() - ci.getTime()) / 60000 - (p.break_minutes || 0)) / 60).toFixed(2))
          : 0;
        punchAoa.push([
          name,
          format(ci, "yyyy-MM-dd"),
          format(ci, "EEE"),
          format(ci, "HH:mm"),
          co ? format(co, "HH:mm") : "(open)",
          p.break_minutes || 0,
          hrs > 0 ? hrs : "—",
        ]);
      });

      const wsPunches = XLSX.utils.aoa_to_sheet(punchAoa);
      wsPunches["!cols"] = [
        { wch: 26 }, { wch: 12 }, { wch: 6 },
        { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
      ];
      wsPunches["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
      XLSX.utils.book_append_sheet(wb, wsPunches, "Daily Punches");
    }

    // ---------- Sheet 3: Weekly Breakdown (only when computed payroll exists) ----------
    if (hasSummary) {
      const weekAoa: (string | number)[][] = [];
      weekAoa.push([`Weekly Breakdown — ${rangeLabel}`]);
      weekAoa.push([]);
      weekAoa.push(["Employee", "Type", "Week Start", "Week End", "Regular", "Overtime", "Total Paid", "Exceptions", "Status"]);

      const sortedSummaries = [...summaries].sort((a, b) => {
        const an = profileMap.get(a.profile_id)?.full_name || "";
        const bn = profileMap.get(b.profile_id)?.full_name || "";
        if (an !== bn) return an.localeCompare(bn);
        return a.week_start.localeCompare(b.week_start);
      });

      sortedSummaries.forEach((s) => {
        const name = profileMap.get(s.profile_id)?.full_name || "Unknown";
        weekAoa.push([
          name, s.employee_type, s.week_start, s.week_end,
          Number(Number(s.regular_hours).toFixed(2)),
          Number(Number(s.overtime_hours).toFixed(2)),
          Number(Number(s.total_paid_hours).toFixed(2)),
          s.total_exceptions, s.status,
        ]);
      });

      const wsWeek = XLSX.utils.aoa_to_sheet(weekAoa);
      wsWeek["!cols"] = [
        { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
      ];
      wsWeek["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];
      XLSX.utils.book_append_sheet(wb, wsWeek, "Weekly Breakdown");
    }

    const fileName = `payroll_${format(rangeStart, "yyyyMMdd")}_${format(rangeEnd, "yyyyMMdd")}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("Excel report downloaded");
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
          {aggregated.length} employee{aggregated.length !== 1 ? "s" : ""}
          {usingFallback
            ? ` · ${punches.length} punch${punches.length !== 1 ? "es" : ""} (raw)`
            : ` · ${summaries.length} week${summaries.length !== 1 ? "s" : ""}`}
        </Badge>

        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportXlsx} disabled={aggregated.length === 0 && punches.length === 0}>
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export Excel
        </Button>
      </div>

      {usingFallback && aggregated.length > 0 && (
        <p className="text-[11px] text-muted-foreground px-1">
          Showing raw clock-in/clock-out totals — no payroll has been computed for this range yet.
        </p>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm text-center py-8">Loading payroll data...</p>
      ) : aggregated.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <DollarSign className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No clock-in records or payroll summary in this range.</p>
          <p className="text-xs text-muted-foreground">
            {format(rangeStart, "MMM d, yyyy")} – {format(rangeEnd, "MMM d, yyyy")}
          </p>
        </div>
      ) : (
        <div>
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

                    {usingFallback && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 -mx-2"
                          onClick={() => setExpanded((prev) => ({ ...prev, [s.profile_id]: !prev[s.profile_id] }))}
                        >
                          {expanded[s.profile_id] ? <ChevronDown className="w-3.5 h-3.5 mr-1" /> : <ChevronRight className="w-3.5 h-3.5 mr-1" />}
                          {expanded[s.profile_id] ? "Hide" : "Show"} daily breakdown
                        </Button>
                        {expanded[s.profile_id] && (
                          <div className="rounded-md border border-border overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/50">
                                <tr className="text-left">
                                  <th className="px-2 py-1.5 font-medium">Date</th>
                                  <th className="px-2 py-1.5 font-medium">Clock In</th>
                                  <th className="px-2 py-1.5 font-medium">Clock Out</th>
                                  <th className="px-2 py-1.5 font-medium text-right">Hours</th>
                                </tr>
                              </thead>
                              <tbody>
                                {punches
                                  .filter((p) => p.profile_id === s.profile_id)
                                  .sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime())
                                  .map((p) => {
                                    const ci = new Date(p.clock_in);
                                    const co = p.clock_out ? new Date(p.clock_out) : null;
                                    const hrs = co
                                      ? ((co.getTime() - ci.getTime()) / 60000 - (p.break_minutes || 0)) / 60
                                      : null;
                                    return (
                                      <tr key={p.id} className="border-t border-border">
                                        <td className="px-2 py-1.5 tabular-nums">{format(ci, "EEE MMM d")}</td>
                                        <td className="px-2 py-1.5 tabular-nums">{format(ci, "h:mm a")}</td>
                                        <td className="px-2 py-1.5 tabular-nums">
                                          {co ? format(co, "h:mm a") : <span className="text-orange-500">open</span>}
                                        </td>
                                        <td className="px-2 py-1.5 tabular-nums text-right font-medium">
                                          {hrs !== null && hrs > 0 ? hrs.toFixed(2) : "—"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
