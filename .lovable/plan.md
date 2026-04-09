

# Improve Vizzy Employee Report Quality

## Problem
When asked for an employee report (e.g., "vicky report"), Vizzy produces a shallow report that:
- Flags "not clocked in" at midnight (nobody works at midnight)
- Does not query the Employee Tasks board for their actual workload
- Does not check RingCentral call logs for the person
- Does not thoroughly check emails sent/received with date ranges
- Gives a generic summary instead of a comprehensive operational picture

## Root Cause
The Vizzy system prompt (`vizzyIdentity.ts`) has no specific protocol for generating employee reports. Vizzy ad-hocs it using `investigate_entity` (which searches by keyword, not employee-specific) instead of systematically calling the right tools.

## Fix: Add Employee Report Protocol to Vizzy System Prompt

**File: `supabase/functions/_shared/vizzyIdentity.ts`**

Add a new section `═══ EMPLOYEE REPORT PROTOCOL ═══` to the system prompt that instructs Vizzy to follow a structured multi-tool investigation when asked for a report on any team member:

```
═══ EMPLOYEE REPORT PROTOCOL ═══
When asked for a report on an employee (e.g., "vicky report", "what did Neel do?", "report on Saurabh"):

STEP 1 — TIME AWARENESS:
- Check current time in ET (America/Toronto). 
- Business hours: Mon-Fri 8AM-5PM ET. 
- Do NOT flag "not clocked in" outside business hours.
- Do NOT flag absence on weekends or holidays.
- Frame attendance relative to business hours only.

STEP 2 — GATHER ALL DATA (run these tools IN PARALLEL):
a) list_tasks → filter by assigned_to_name = employee name, status = open/in_progress
b) get_employee_activity → today + last 7 days
c) get_employee_emails → last 7 days, direction = all
d) rc_get_call_analytics → last 7 days (check for calls by this person)
e) investigate_entity → search by employee name for cross-domain context

STEP 3 — COMPILE COMPREHENSIVE REPORT with these sections:
1. **Current Status**: Clock-in status (only relevant during business hours), last active timestamp
2. **Open Tasks** (from tasks table): List ALL open/in-progress tasks with due dates, priorities, who assigned them. Flag overdue tasks.
3. **Completed Tasks** (last 7 days): What they finished recently
4. **Email Activity** (last 7 days): Total sent/received, key threads, unresolved threads, response time patterns
5. **Phone Activity** (last 7 days): Calls made/received, duration, missed calls
6. **Digital Activity** (today): Page visits, actions taken in the system
7. **Workload Assessment**: Is their plate full or light? Are deadlines realistic?
8. **Risk Flags**: Overdue tasks, unanswered emails >48h, missed calls pattern, no activity during business hours
9. **Recommended Actions**: Specific, actionable next steps

CRITICAL RULES:
- NEVER report "0 calls" without actually calling rc_get_call_analytics
- NEVER say "no tasks" without calling list_tasks with their name
- ALWAYS use multiple date ranges — today AND last 7 days — for a complete picture
- Frame findings in business context, not raw data dumps
```

## Result
- Employee reports will be comprehensive: tasks + emails + calls + activity
- Time-aware: no false alarms at midnight or weekends
- Data-complete: uses all available tools instead of just `investigate_entity`
- Actionable: clear risk flags and recommendations

## Files Modified
| File | Change |
|------|--------|
| `supabase/functions/_shared/vizzyIdentity.ts` | Add EMPLOYEE REPORT PROTOCOL section to system prompt |

