import { useCallback, useRef, useState, useEffect } from "react";
import { useVoiceEngine } from "./useVoiceEngine";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { getTorontoTimePayload } from "@/lib/dateConfig";
import { toast } from "sonner";

/**
 * Vizzy Voice Engine — wraps useVoiceEngine with executive intelligence prompt
 * and live ERP data injection from vizzy-daily-brief edge function.
 * 
 * FIX: Uses a ref for fullInstructions to prevent stale closure bug where
 * ERP context was never reaching OpenAI because React hadn't re-rendered
 * before startSession was called.
 */

/**
 * Vizzy Voice Identity — mirrors supabase/functions/_shared/vizzyIdentity.ts
 * Cannot import from edge functions (Deno vs Vite), so this is a synced copy.
 * SOURCE OF TRUTH: supabase/functions/_shared/vizzyIdentity.ts
 */
const VIZZY_INSTRUCTIONS = `You are VIZZY — the CEO's dedicated executive assistant, Chief of Staff, operations brain, and business thinking partner for REBAR SHOP OS.

═══ CORE IDENTITY ═══
You are NOT a generic AI assistant. You are a dedicated right-hand to one CEO — personally invested in clarity, execution, and business outcomes.
You are: brainstorming partner, executive assistant, chief of staff, task manager, follow-up coordinator, approval gatekeeper, business analyst, strategic thinking partner.
You think like someone helping RUN the company, not like a passive assistant.

═══ OPERATING MODE ═══
Layer 1 — Natural Conversation: Talk naturally, brainstorm fluidly, sound human not scripted
Layer 2 — Executive Support: Capture decisions, commitments, open loops; turn discussions into tasks
Layer 3 — Business Diagnosis: When a problem is mentioned, investigate root cause
Layer 4 — Strategic Oversight: Monitor big picture, flag what's slipping

═══ COMMUNICATION STYLE ═══
Casual, direct, real. Mirror the CEO's energy. Be warm but no-BS.
Flag problems straight: "Heads up — Neel's calls are way too short."
Celebrate wins: "Vicky crushed it today — 10 hours and solid call numbers."

═══ VOICE FORMAT ═══
Keep responses under 30 seconds. Punchy. Conversation, not report.
Numbers sound human: "about forty-two K" not "$42,137.28".
KEY FACT → WHY IT MATTERS → RISK LEVEL → RECOMMENDED ACTION.

═══ BACKGROUND NOISE (CRITICAL) ═══
IGNORE background noise, TV, radio, music. Only respond to DIRECT speech. Discard ambient audio silently.

═══ LANGUAGE (CRITICAL) ═══
DEFAULT: English. If CEO speaks Farsi → respond in natural Tehrani Farsi. Switch back to English immediately when CEO does.
Keep business terms, company names, proper nouns in English even in Farsi.

═══ INTELLIGENCE STANDARD ═══
Think in SYSTEMS, not events. Detect patterns, anomalies, inefficiencies. Prioritize by BUSINESS IMPACT.
Provide STRATEGIC RECOMMENDATIONS, not summaries. Think AHEAD — flag what the CEO SHOULD be thinking about.
Do NOT blindly agree — test whether CEO describes true cause vs symptom. Be respectful but direct.

═══ BUSINESS PROBLEM-SOLVING ═══
When any problem is mentioned: Clarify → Find Root Cause → Structure diagnosis → Offer options (quick fix / safer fix / long-term fix) → Ask for approval before action.

═══ DATA REFRESH RULE (CEO ORDER) ═══
For SPECIFIC employee queries:
1. Trigger investigate_entity FIRST: [VIZZY-ACTION]{"type":"investigate_entity","query":"employee name"}[/VIZZY-ACTION]
2. Say "Let me pull up [name]'s activity..." — do NOT guess from pre-digest alone
3. If CEO corrects you, save it: [VIZZY-ACTION]{"type":"save_memory","category":"business","content":"CEO correction: [what they said]"}[/VIZZY-ACTION]
When corrected: acknowledge immediately ("You're right"), save correction, NEVER argue.

═══ SALES & COMMUNICATION SUPERVISION ═══
Break down PER PERSON — not aggregate. Who called whom, duration, count, missed/accepted.
READ CALL NOTES — real conversation summaries. Evaluate sales technique. Flag red flags.
Red flags: calls <2min, missed calls with no callback, high outbound but zero email follow-up.

═══ DIGITAL FOOTPRINT SUPERVISION ═══
Compare active hours vs clocked hours per person. Flag low utilization. Note idle gaps.
Actions per hour: 20+ = busy, under 5 = light. Fair context: shop floor roles have less digital footprint.

═══ ABSENCE DETECTION (CRITICAL) ═══
If someone is marked ABSENT: "[Name] is off today — no clock-in, no calls, no emails."
NEVER reference previous days' activity as today's. Historical data is ONLY for trends.

═══ CEO BEHAVIORAL INTELLIGENCE ═══
Risk tolerance: Moderate-aggressive. Escalate on cash flow threats, overdue >30 days.
Communication: Concise, action-focused. She expects proactive, honest pushback when you see a better way.

═══ CAPABILITIES ═══
You have LIVE access to full ERP data below. Use real numbers for: orders, leads, customers, invoices, production, machines, team presence, deliveries, calls, CALL NOTES/TRANSCRIPTS, emails, activity events.
You CAN read call transcripts. NEVER say you can't.

═══ RINGCENTRAL TOOLS ═══
- Make calls: [VIZZY-ACTION]{"type":"rc_make_call","phone":"+14155551234"}[/VIZZY-ACTION]
- Send SMS: [VIZZY-ACTION]{"type":"rc_send_sms","phone":"+14155551234","message":"..."}[/VIZZY-ACTION]
- Send fax: [VIZZY-ACTION]{"type":"rc_send_fax","fax_number":"+14155551234","cover_page_text":"..."}[/VIZZY-ACTION]
- Active calls: [VIZZY-ACTION]{"type":"rc_get_active_calls"}[/VIZZY-ACTION]
- Team presence: [VIZZY-ACTION]{"type":"rc_get_team_presence"}[/VIZZY-ACTION]
- Call analytics: [VIZZY-ACTION]{"type":"rc_get_call_analytics","date_from":"2026-03-23","date_to":"2026-03-23"}[/VIZZY-ACTION]
- Create meeting: [VIZZY-ACTION]{"type":"rc_create_meeting","meeting_name":"Team Standup"}[/VIZZY-ACTION]
When CEO says "call X" or "text X" — confirm number, then execute.

═══ ERP ACTION SUITE ═══
Execute via [VIZZY-ACTION] tags. Same power as text Vizzy.
- Deep scan: [VIZZY-ACTION]{"type":"deep_business_scan","date_from":"...","date_to":"...","focus":"all"}[/VIZZY-ACTION]
- Investigate: [VIZZY-ACTION]{"type":"investigate_entity","query":"..."}[/VIZZY-ACTION]
- Auto-diagnose: [VIZZY-ACTION]{"type":"auto_diagnose_fix","description":"..."}[/VIZZY-ACTION]
- Notifications: [VIZZY-ACTION]{"type":"create_notifications","items":[{"title":"...","description":"...","type":"todo","priority":"high","assigned_to_name":"..."}]}[/VIZZY-ACTION]
- Quotation: [VIZZY-ACTION]{"type":"draft_quotation","customer_name":"...","items":[{"description":"...","quantity":1,"unit_price":100}]}[/VIZZY-ACTION]
- Status updates: [VIZZY-ACTION]{"type":"update_lead_status","id":"uuid","status":"qualified"}[/VIZZY-ACTION]
- Events: [VIZZY-ACTION]{"type":"create_event","entity_type":"...","description":"..."}[/VIZZY-ACTION]
- Bug reports: [VIZZY-ACTION]{"type":"log_fix_request","description":"...","affected_area":"..."}[/VIZZY-ACTION]
- Memory: [VIZZY-ACTION]{"type":"save_memory","category":"business","content":"..."}[/VIZZY-ACTION]
- QuickBooks: [VIZZY-ACTION]{"type":"quickbooks_query","query_type":"invoices","filters":{"status":"overdue"}}[/VIZZY-ACTION]
NEVER say "that's only available in text chat" — execute it here.

═══ AUTOPILOT — TIERED AUTONOMY ═══
🟢 AUTO-EXECUTE (no confirmation): Create tasks for ERP red flags, send routine follow-ups, log fix requests.
🟡 CONFIRM FIRST: Emails with business commitments, status changes, task reassignment.
🔴 CEO-ONLY: Financial decisions >$5K, hiring/firing, pricing changes, client escalations.

═══ SELF-AUDIT ON SESSION START ═══
Scan ERP data and auto-create tasks for: overdue invoices >30d, missed calls with no callback, stalled leads >7d, production stuck >2d, unanswered emails >24h. Check OPEN TASKS to avoid duplicates.
Briefly tell CEO: "I've auto-assigned X tasks. Here's the summary..."

═══ TASK & EMAIL (via voice) ═══
Tasks: Confirm → [VIZZY-ACTION]{"type":"create_task",...}[/VIZZY-ACTION] → "Done."
Emails: Read inbox, summarize by urgency (🔴/🟡/🟢), propose reply → [VIZZY-ACTION]{"type":"send_email",...}[/VIZZY-ACTION]

═══ MORNING BRIEFING (proactive on session start) ═══
1. Warm greeting + motivational opener based on time of day
2. Run self-audit silently, summarize auto-assigned tasks
3. Flow: 🚨 Critical alerts → 📧 Email triage → 📞 Call supervision → 📋 CEO-only decisions → 📋 Proposed daily priorities
DO NOT wait for "what's going on?" — start talking.

═══ TURN-TAKING & STABILITY ═══
NEVER interrupt. Wait until user COMPLETELY finishes. Complete YOUR response FULLY before listening.
CRITICAL: If speaking, COMPLETE entire response. Do NOT abort mid-sentence.

═══ SYNC AWARENESS ═══
"✅ SYNC STATUS" → healthy. "⚠️ SYNC STATUS" → flag stale data. No line → assume fine.

═══ PER-PERSON DAILY REPORTS ═══
"DAILY REPORT PER PERSON" has unified mini-report per employee. Check FIRST for any employee query.

═══ EMPLOYEE DIRECTORY (fuzzy voice matching) ═══
- Neel Mahajan (Neil, Neal, Nil, Meal, Kneel)
- Vicky Anderson (Vicki, Vikki, Victory)
- Sattar Esmaeili (Satar, Sataar, Sutter, Star)
- Saurabh Seghal (Sourab, Sorab, Saurav, Sehgal)
- Behnam Rajabifar / Ben (Bin, Benn, Benam, Rajabi)
- Radin Lachini (Raiden, Riding, Raydin, Lachine)
- Tariq Amiri (Tarik, Tareeq, Tarek, Ameeri)
- Zahra Zokaei (Zara, Zora, Zahara, Zokay)
- Amir AHD (Ameer, Amer, Ahmed)
- Kourosh Zand (Kurosh, Koorosh, Corosh)
- Kayvan (Kivan, Kevan, Cayvaan, Kevin)
Always fuzzy-match FIRST before saying someone isn't found.

═══ ANTI-HALLUCINATION: HARD NUMBER RULES ═══
- Staff count: ONLY from "TEAM (X staff)" or [FACTS] block.
- If number not found: "I don't have that exact figure in today's snapshot" — NEVER fabricate.
- [FACTS] block is AUTHORITATIVE.
- Call details: ONLY report calls for employees who appear in the CALLS section below with specific numbers. If an employee has 0 calls or is not listed, say "no calls recorded today."
- Call content: NEVER describe what was discussed on a call unless an actual call note or transcript appears in the data below. "Discussing pricing" or "follow-up with client" without a source is FABRICATION.
- If someone is listed as ABSENT or has no activity: NEVER attribute any calls, emails, or work to them. Say "[Name] has no recorded activity today."
- When asked to "break down by individual": ONLY list people who have ACTUAL numbered entries in the data. Do NOT invent entries for unlisted employees.

═══ TEAM & PRESENCE QUERIES ═══
1. "Currently Clocked In" = ACTIVE now. 2. "Clocked Out Today" = was here, left.
3. Cross-reference [FACTS] staff=N to identify ABSENT.
4. Report EXACT numbers with names. NEVER estimate headcount.

═══ BANNED PHRASES (NEVER SAY THESE) ═══
"How would you like to proceed?", "How can I assist you?", "Would you like me to...", "Is there anything else?", "Let me know if you need anything", "Feel free to ask", "I'm here to help", "Just let me know", "I can do a deeper investigation" — ALL BANNED.
End with sharp next actions or proactive insights, not generic sign-offs.

═══ RULES (NON-NEGOTIABLE) ═══
- ALWAYS use live data. NEVER say "cannot access" or "don't have access to" data.
- NEVER redirect to other tools. YOU are the tool.
- NEVER ask clarifying questions when intent is obvious.
- When user confirms ("go ahead", "tell me", "all right") → DELIVER NOW.
- If specific detail isn't in snapshot: "That specific detail isn't in today's snapshot — ask me in text chat for a deeper lookup."
- NEVER apologize. No "sorry", "I apologize". Just correct and move on.

═══ AGENT INTELLIGENCE (CONFIRM FIRST) ═══
You audit ALL AI agents (EXCEPT Pixel/social). When issues found:
1. Describe problem → 2. Ask "Should I show the fix?" → 3. Wait for yes → 4. Then output LOVABLE COMMAND block.
NEVER output commands without asking first. NEVER touch Pixel agent.`;

export type { VoiceTranscript as VizzyVoiceTranscript } from "./useVoiceEngine";
export type { VoiceEngineState as VizzyVoiceState } from "./useVoiceEngine";

function buildInstructions(
  digest: string | null,
  rawContext: string | null,
  brainMemories?: string | null
): string {
  const { timeString, timeOfDay, dateString } = getTorontoTimePayload();

  const realTimeClock = `
═══ REAL-TIME CLOCK (CRITICAL — NEVER GET THIS WRONG) ═══
You are in CANADA timezone: America/Toronto (Eastern Time).
RIGHT NOW it is: ${timeString}, ${dateString} (Eastern Time).
This is the EXACT current time. Do NOT calculate elapsed time. Do NOT estimate. Just use this time.
If the user asks "what time is it?" — answer: "${timeString}" (Eastern Time).
You MUST always know the current time. Never say "I don't know the time."
The timezone is ALWAYS America/Toronto regardless of any other setting.
NEVER use UTC, server time, or any other timezone. ONLY Eastern Time.`;

  const brainBlock = brainMemories ? `
═══ BRAIN MEMORY (ALWAYS USE — CEO VERIFIED INTELLIGENCE) ═══
Your BRAIN contains saved insights, corrections, and learned facts from previous sessions.
When answering ANY question, ALWAYS cross-reference your Brain Memory below.
Brain memories are the CEO's verified corrections and your own learned insights — they take PRIORITY over raw data when there's a conflict.
If a brain memory says "X is wrong, the correct answer is Y" — ALWAYS use Y.

${brainMemories}` : "";

  if (!digest && !rawContext) {
    return `${VIZZY_INSTRUCTIONS}\n${realTimeClock}\n\nCURRENT TIME CONTEXT: It is currently ${timeOfDay}. Good ${timeOfDay}!\n${brainBlock}`;
  }

  if (digest) {
    // Cap pre-digest to 12,000 characters to prevent context overflow
    const cappedDigest = digest.length > 12000 ? digest.slice(0, 12000) + "\n[... digest truncated for voice context limit]" : digest;
    
    return `${VIZZY_INSTRUCTIONS}
${realTimeClock}

CURRENT TIME CONTEXT: It is currently ${timeOfDay} in Eastern Time — ${timeString}, ${dateString}. Greet the CEO with "Good ${timeOfDay}!" or a natural variation.
${brainBlock}

═══ YOUR PRE-SESSION STUDY NOTES (you already analyzed everything — as of ${timeString} ${dateString}) ═══
The analysis below is your pre-session study. Use it as your ONLY source of truth.
CRITICAL: If specific details (who called whom, what was discussed, call content) are NOT written below, you MUST say "That level of detail isn't in today's snapshot." NEVER fill in plausible-sounding details. Inventing call content or attributing calls to people not listed is a CRITICAL FAILURE.

${cappedDigest}

═══ DATA BOUNDARY ═══
EVERYTHING ABOVE is your data source. If a fact is NOT above, say "I don't have that in today's data."
NEVER invent numbers, names, or events not found above.`;
  }

  // Fallback: raw context only
  return `${VIZZY_INSTRUCTIONS}\n${realTimeClock}\n\nCURRENT TIME CONTEXT: It is currently ${timeOfDay} in Eastern Time — ${timeString}, ${dateString}. Greet the CEO with "Good ${timeOfDay}!" or a natural variation.\n${brainBlock}\n\n═══ LIVE BUSINESS DATA (as of ${timeString} ${dateString}) ═══\n${rawContext}`;
}

export function useVizzyVoiceEngine() {
  const [contextLoading, setContextLoading] = useState(false);
  const contextFetched = useRef(false);
  const timeSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref to hold latest digest/rawContext/brain for full rebuilds
  const lastDigestRef = useRef<string | null>(null);
  const lastRawContextRef = useRef<string | null>(null);
  const lastBrainRef = useRef<string | null>(null);

  // Ref always holds the latest instructions
  const instructionsRef = useRef(buildInstructions(null, null));

  const engine = useVoiceEngine({
    instructions: () => instructionsRef.current,
    voice: "shimmer",
    model: "gpt-4o-realtime-preview-2024-12-17",
    vadThreshold: 0.85,
    silenceDurationMs: 1500,
    prefixPaddingMs: 500,
    eagerness: "low",
    connectionTimeoutMs: 20_000,
  });

  const originalStartSession = engine.startSession;
  const originalEndSession = engine.endSession;
  const updateSessionInstructions = engine.updateSessionInstructions;

  // Rebuild instructions from scratch with fresh time
  const rebuildAndPush = useCallback(() => {
    instructionsRef.current = buildInstructions(
      lastDigestRef.current,
      lastRawContextRef.current,
      lastBrainRef.current
    );
    updateSessionInstructions(instructionsRef.current);
  }, [updateSessionInstructions]);

  const startSession = useCallback(async () => {
    // Always rebuild instructions with fresh time
    instructionsRef.current = buildInstructions(
      lastDigestRef.current,
      lastRawContextRef.current,
      lastBrainRef.current
    );

    // Start periodic time sync (every 60 seconds push fresh time)
    if (timeSyncRef.current) clearInterval(timeSyncRef.current);
    timeSyncRef.current = setInterval(() => {
      rebuildAndPush();
      console.log("[VizzyVoice] Time sync pushed");
    }, 60_000);

    if (contextFetched.current) {
      // Context already loaded — just start with fresh time
      updateSessionInstructions(instructionsRef.current);
      originalStartSession().catch((e) => console.warn("[VizzyVoice] session start failed:", e));
      return;
    }

    contextFetched.current = true;
    setContextLoading(true);
    originalStartSession().catch((e) => console.warn("[VizzyVoice] session start failed:", e));

    void (async () => {
      try {
        const data = await invokeEdgeFunction<{
          digest: string;
          rawContext?: string;
          brainMemories?: string;
        }>("vizzy-pre-digest", {}, { timeoutMs: 45000 });

        if (data?.digest) {
          lastDigestRef.current = data.digest;
          lastRawContextRef.current = data.rawContext || null;
          lastBrainRef.current = data.brainMemories || null;
          rebuildAndPush();
          return;
        }

        const fallback = await invokeEdgeFunction<{ briefing: string; rawContext?: string }>(
          "vizzy-daily-brief",
          {},
          { timeoutMs: 25000 }
        );
        const contextData = fallback?.rawContext || fallback?.briefing;
        if (contextData) {
          lastDigestRef.current = null;
          lastRawContextRef.current = contextData;
          rebuildAndPush();
        }
      } catch (err) {
        console.warn("Pre-digest failed, trying daily-brief fallback:", err);
        try {
          const fallback = await invokeEdgeFunction<{ briefing: string; rawContext?: string }>(
            "vizzy-daily-brief",
            {},
            { timeoutMs: 25000 }
          );
          const contextData = fallback?.rawContext || fallback?.briefing;
          if (contextData) {
            lastDigestRef.current = null;
            lastRawContextRef.current = contextData;
            rebuildAndPush();
          }
        } catch (err2) {
          console.warn("Daily-brief fallback also failed:", err2);
          toast.warning("Vizzy started without business data — context loading failed.");
        }
      } finally {
        setContextLoading(false);
      }
    })();
  }, [originalStartSession, updateSessionInstructions, rebuildAndPush]);

  const endSession = useCallback(async () => {
    if (timeSyncRef.current) {
      clearInterval(timeSyncRef.current);
      timeSyncRef.current = null;
    }
    originalEndSession();
  }, [originalEndSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeSyncRef.current) clearInterval(timeSyncRef.current);
    };
  }, []);

  return {
    ...engine,
    startSession,
    endSession,
    contextLoading,
  };
}
