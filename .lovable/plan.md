

# AI Lead Prospecting Pipeline

## Overview

Add a new **"Prospecting"** pipeline stage and a dedicated prospecting page where users can click a button to have AI generate 50 new lead prospects. The AI uses web intelligence to find relevant construction/rebar industry leads. Users review each prospect in an audit table, and with one click can send a personalized introduction email via the existing Gmail integration.

## New Pipeline Stage

Add `prospecting` as the first stage in `PIPELINE_STAGES`:
```text
{ id: "prospecting", label: "Prospecting", color: "bg-indigo-500" }
```
This stage holds AI-discovered leads that haven't been qualified yet.

## New Edge Function: `prospect-leads`

A backend function that uses **Lovable AI** (Gemini 3 Flash) to generate 50 realistic, targeted lead prospects for rebar fabrication. The AI is prompted with:
- Your company profile (rebar.shop, Canadian rebar fabrication)
- Target industries (general contractors, structural engineers, developers, precast companies)
- Geographic focus (user can specify region or default to Canada/USA)
- Output: structured JSON array of 50 prospects via tool calling

Each prospect includes:
- Company name, contact name, title/role
- Email (best guess format based on company domain)
- Phone (if inferable)
- Industry vertical, city/region
- Estimated project value range
- Reason for fit (why this is a good lead)
- Suggested introduction angle

## New DB Table: `prospect_batches`

Stores each prospecting run:

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| created_by | uuid | FK profiles |
| company_id | uuid | FK companies |
| region | text | Target region |
| status | text | generating, ready, archived |
| prospect_count | int | Number generated |
| created_at | timestamptz | |

## New DB Table: `prospects`

Stores individual AI-generated prospects:

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| batch_id | uuid | FK prospect_batches |
| company_name | text | Prospect company |
| contact_name | text | Decision maker |
| contact_title | text | Their role |
| email | text | Best-guess email |
| phone | text | nullable |
| city | text | |
| industry | text | vertical |
| estimated_value | numeric | nullable |
| fit_reason | text | Why they're a good lead |
| intro_angle | text | Suggested pitch angle |
| status | text | pending, approved, rejected, emailed |
| lead_id | uuid | FK leads, set when promoted |
| company_id | uuid | FK companies |
| created_at | timestamptz | |

## New Page: `/prospecting`

A dedicated page (linked from Pipeline header) with:

1. **Header**: "AI Lead Prospecting" + region selector + "Dig 50 Leads" button
2. **Results Table**: Shows prospects from the latest batch in a clean audit table
3. **Each row shows**: Company, Contact, Title, Email, City, Industry, Fit Reason, Status
4. **Row actions**:
   - **Approve** (thumbs up) -- marks as approved, creates a real lead in `leads` table at `prospecting` stage
   - **Reject** (thumbs down) -- marks as rejected, grays out
   - **Send Intro** (mail icon) -- opens a pre-filled email dialog with AI-generated introduction email, sends via `gmail-send`

## AI Introduction Email

When user clicks "Send Intro" on an approved prospect:
1. Call `pipeline-ai` with a new `draft_intro` action that generates a personalized cold introduction email
2. Show the draft in a dialog for user review/edit
3. On send, use existing `gmail-send` function
4. Update prospect status to `emailed`
5. Auto-create the lead in `leads` table if not already promoted

## File Changes Summary

| File | Action | Description |
|---|---|---|
| `src/pages/Pipeline.tsx` | Edit | Add `prospecting` stage, add "Prospect" button in header |
| `src/pages/Prospecting.tsx` | Create | New page with audit table + dig button |
| `src/components/prospecting/ProspectTable.tsx` | Create | Audit table component |
| `src/components/prospecting/ProspectIntroDialog.tsx` | Create | Email preview/send dialog |
| `supabase/functions/prospect-leads/index.ts` | Create | AI prospecting edge function |
| `supabase/functions/pipeline-ai/index.ts` | Edit | Add `draft_intro` action |
| `src/App.tsx` | Edit | Add `/prospecting` route |
| `src/hooks/useActiveModule.ts` | Edit | Add prospecting to route map |
| DB migration | Create | `prospect_batches` + `prospects` tables with RLS |
| `supabase/config.toml` | Edit | Add prospect-leads function config |

## Technical Details

### Edge Function (`prospect-leads/index.ts`)
- Uses Lovable AI gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`)
- Model: `google/gemini-3-flash-preview`
- Uses tool calling to return structured array of 50 prospects
- Inserts results into `prospects` table via service client
- Returns batch ID to frontend

### Lead Promotion Flow
When a prospect is approved:
1. Insert into `leads` table with `stage: "prospecting"`, `source: "ai_prospecting"`
2. Store prospect metadata (fit_reason, intro_angle) in `leads.metadata`
3. Link back via `prospects.lead_id`

### RLS Policies
- Both tables scoped to `company_id` matching user's company
- Read/write for authenticated users within same company

### Introduction Email Template
The AI generates a personalized email based on:
- Prospect's company, industry, city
- The fit reason and intro angle
- rebar.shop's value proposition
- Professional, non-spammy tone

User can edit before sending. Email is sent through existing Gmail integration.

