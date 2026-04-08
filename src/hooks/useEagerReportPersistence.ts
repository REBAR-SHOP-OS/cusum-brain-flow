import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateInTimezone } from "@/lib/dateConfig";
import type { TeamMemberActivity } from "@/hooks/useTeamDailyActivity";

interface ProfileSlim {
  id: string;
  full_name: string;
  user_id: string | null;
  title?: string;
}

function humanLabel(t: string): string {
  const map: Record<string, string> = {
    page_visit: "Page Visit",
    email_sent: "Email Sent",
    email_received: "Email Received",
    lead_created: "Lead Created",
    lead_updated: "Lead Updated",
    note_added: "Note Added",
    task_completed: "Task Completed",
    chat_message: "Chat Message",
    file_uploaded: "File Uploaded",
    quote_created: "Quote Created",
    invoice_created: "Invoice Created",
    contact_created: "Contact Created",
  };
  return map[t] || t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function useEagerReportPersistence(
  profiles: ProfileSlim[],
  teamData: Record<string, TeamMemberActivity> | undefined,
  date: Date,
  timezone: string
) {
  const lastKey = useRef<string>("");

  useEffect(() => {
    if (!teamData || profiles.length === 0) return;

    const dateStr = formatDateInTimezone(date, timezone, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const key = `${dateStr}_${profiles.map((p) => p.id).join(",")}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    const persist = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const companyId = user.user_metadata?.company_id ?? "";

      const dateLong = formatDateInTimezone(date, timezone, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const sep = "══════════════════════════════════════════";
      const thin = "──────────────────────────────────────────";

      for (const p of profiles) {
        const uid = p.user_id;
        if (!uid) continue;
        const d = teamData[p.id];
        if (!d) continue;

        const lines: string[] = [];
        lines.push(sep);
        lines.push(`  DAILY REPORT — ${p.full_name}`);
        lines.push(`  ${dateLong}`);
        lines.push(sep);
        lines.push("");

        // Attendance
        const clockedIn = d.clockEntries.some((ce) => !ce.clock_out);
        lines.push("ATTENDANCE");
        lines.push(`  Status:      ${clockedIn ? "Clocked In" : "Off Clock"}`);
        lines.push(`  Gross Hours: ${d.hoursToday.toFixed(1)}h`);

        if (d.clockEntries.length > 0) {
          lines.push("  Clock Entries:");
          for (const ce of [...d.clockEntries].reverse()) {
            const inTime = formatDateInTimezone(ce.clock_in, timezone, {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });
            const outTime = ce.clock_out
              ? formatDateInTimezone(ce.clock_out, timezone, {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })
              : "ongoing";
            const durMs =
              (ce.clock_out
                ? new Date(ce.clock_out).getTime()
                : Date.now()) - new Date(ce.clock_in).getTime();
            const durH = Math.round(durMs / 360000) / 10;
            lines.push(`    • ${inTime} → ${outTime} (${durH}h)`);
          }
        } else {
          lines.push("  Clock Entries: None");
        }

        lines.push("");
        lines.push(thin);
        lines.push("");

        // Performance
        lines.push("PERFORMANCE SUMMARY");
        lines.push(`  Activities:   ${d.activities.length}`);
        lines.push(`  AI Sessions:  ${d.aiSessionsToday}`);
        lines.push(`  Emails Sent:  ${d.emailsSent}`);

        // Activity breakdown
        const typeCounts: Record<string, number> = {};
        for (const ev of d.activities) {
          typeCounts[ev.event_type] = (typeCounts[ev.event_type] || 0) + 1;
        }
        const sorted = Object.entries(typeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        if (sorted.length > 0) {
          lines.push("");
          lines.push(thin);
          lines.push("");
          lines.push("ACTIVITY BREAKDOWN");
          for (const [t, c] of sorted) {
            const label = humanLabel(t);
            const dots = ".".repeat(Math.max(2, 30 - label.length));
            lines.push(`  ${label} ${dots} ${c}`);
          }
        }

        lines.push("");
        lines.push(sep);

        const reportText = lines.join("\n");
        const category = `user_daily_report_${uid}_${dateStr}`;

        await supabase.from("vizzy_memory").upsert(
          {
            user_id: uid,
            company_id: companyId,
            category,
            content: reportText,
          },
          { onConflict: "user_id,category" }
        );
      }
    };

    persist().catch(console.error);
  }, [profiles, teamData, date, timezone]);
}
