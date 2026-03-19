

# Smart Feedback Analysis: Deep Understanding + Clarification + Right-Person Routing

## Problem

Currently, `analyze-feedback-fix` blindly generates a Lovable patch from every feedback — even when the problem is unclear, the screenshot is ambiguous, or it's an operational issue (not a code bug). There's no mechanism to:
1. Ask the CEO for clarification when the AI doesn't understand the feedback
2. Route to the right person in the company when neither the AI nor the CEO can resolve it
3. Use agent task history as additional context for smarter analysis

## Changes

### 1. Enhanced `analyze-feedback-fix` Edge Function — Confidence-Based Triage

Upgrade the AI prompt to output a **confidence level** and **classification**:
- `high_confidence` → Generate patch as usual, save to `vizzy_memory` (category: `feedback_fix`)
- `needs_clarification` → Save to `vizzy_memory` (category: `feedback_clarification`) with the AI's specific questions for the CEO
- `not_a_code_bug` → Route to the right person — save to `vizzy_memory` (category: `feedback_escalation`) with recommended assignee and department

The AI also receives **recent agent tasks** (`human_tasks`) and **agent chat history** as extra context for deeper understanding.

**New output format from AI:**
```json
{
  "confidence": "high" | "medium" | "low",
  "type": "code_bug" | "config_issue" | "operational" | "unclear",
  "patch": "LOVABLE COMMAND: ...",
  "questions": ["What exactly happens when you click...?"],
  "recommended_person": "Vicky",
  "recommended_department": "accounting",
  "reasoning": "Why this classification was chosen"
}
```

### 2. Expand FixesQueue with Clarification & Escalation Sections

Add two new sections to the CEO Portal Fixes Queue:

- **Needs Clarification** (yellow cards): Shows AI's questions. CEO can type answers inline → re-triggers analysis with the clarification appended. CEO can also say "I don't know" → routes to recommended person.
- **Escalated to Team** (purple cards): Shows who it was routed to and why. Creates a `human_task` assigned to that person.

### 3. Agent Task History as Context

Before generating the patch, the edge function fetches:
- Last 20 `human_tasks` related to the same page/area (for pattern recognition)
- Last 10 `chat_messages` from agents related to the feedback topic
- Previous `feedback_fix` and `feedback_clarification` entries from `vizzy_memory` (to avoid duplicate questions)

This gives the AI deep historical understanding.

### 4. Re-Analysis After CEO Answers

New endpoint or extended `analyze-feedback-fix` that accepts `clarification_answer` parameter:
- When CEO answers the questions in the Fixes Queue, re-triggers analysis with original feedback + CEO's answer
- If CEO clicks "I don't know / Route to team" → creates `human_task` for the recommended person and marks the item as escalated

## Technical Details

**Files to modify:**
- `supabase/functions/analyze-feedback-fix/index.ts` — Add confidence triage, agent context fetching, tool-calling for structured output, clarification flow
- `src/components/ceo/FixesQueue.tsx` — Add clarification cards with inline answer input, escalation section, re-trigger button

**New vizzy_memory categories:**
- `feedback_clarification` — AI needs CEO input (metadata includes `questions[]`, `recommended_person`, `original_feedback`)
- `feedback_escalation` — Routed to team member (metadata includes `assigned_to`, `department`, `reasoning`)

**AI structured output via tool calling:**
```typescript
body.tools = [{
  type: "function",
  function: {
    name: "classify_and_fix",
    parameters: {
      type: "object",
      properties: {
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        type: {