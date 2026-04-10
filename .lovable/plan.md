

# Fix: Vizzy Must Answer From Its Brain Data, Not Trigger Tools

## Problem
When the CEO asks questions like "how many people work here?" or "who is clocked in?", Vizzy triggers `investigate_entity` and says "let me check..." instead of answering directly from the pre-digest data it already has. The data (staff count, team presence, activity) is already loaded in the system prompt from the `vizzy-pre-digest` edge function.

## Root Cause
In `useVizzyVoiceEngine.ts`, the system instructions have **conflicting rules**:
- **Line 68-73**: "For SPECIFIC employee queries: Trigger `investigate_entity` FIRST" — this fires for ANY employee-related question
- **Line 180-184**: "ANSWER FROM SNAPSHOT FIRST" — this says to use existing data

The AI model encounters the `investigate_entity` instruction first and follows it, ignoring the snapshot-first rule that comes later.

## Fix — `src/hooks/useVizzyVoiceEngine.ts`

### 1. Restructure the DATA REFRESH RULE (lines 68-73)
Change the instruction so `investigate_entity` is ONLY triggered when the data is NOT already in the snapshot. Move the "answer from snapshot" rule to the TOP of instructions and make it the dominant rule.

**Before:**
```
═══ DATA REFRESH RULE (CEO ORDER) ═══
For SPECIFIC employee queries:
1. Trigger investigate_entity FIRST
2. Say "Let me pull up [name]'s activity..."
```

**After:**
```
═══ DATA REFRESH RULE ═══
For employee queries:
1. FIRST check your PRE-SESSION STUDY NOTES and LIVE BUSINESS DATA below
2. If the answer EXISTS in your data → answer IMMEDIATELY. Do NOT trigger investigate_entity.
3. ONLY trigger investigate_entity if you need data NOT in your snapshot (e.g., detailed call transcripts, historical data beyond today)
4. If you DO trigger investigate_entity, say "Let me pull up more details..."
```

### 2. Move ANSWER FROM SNAPSHOT instruction ABOVE capabilities section
Move lines 180-184 up to right after CORE IDENTITY (around line 28) so it's the first behavioral rule the model encounters. Remove it from its current position to avoid duplication.

### 3. Strengthen the snapshot-first wording
```
═══ #1 RULE — ANSWER FROM YOUR DATA FIRST (OVERRIDES ALL OTHER RULES) ═══
Your PRE-SESSION STUDY NOTES below contain ALL of today's business data: staff counts, who's clocked in, revenue, leads, calls, emails, activity per person, agent status.
ALWAYS answer from this data FIRST. Do NOT trigger investigate_entity, deep_business_scan, or any tool for information that is ALREADY in your notes.
Only trigger tools for data you genuinely DO NOT have (e.g., historical comparison, specific call transcript content).
```

## Scope
- 1 file modified: `src/hooks/useVizzyVoiceEngine.ts`
- ~20 lines changed (instruction reordering + rewording)
- No database or edge function changes

