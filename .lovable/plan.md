

# Fix "Unknown" Agent in AI Token Usage — Tag All AI Calls

## Problem
The "By Agent" chart shows 100% "unknown" because none of the ~47 edge functions pass `agentName` when calling `callAI()`. The parameter exists in the shared router but is never populated.

## Solution
Add `agentName` to every `callAI()` and `callAIStream()` call across all edge functions so token usage is properly attributed.

## Changes

Every edge function that calls `callAI()` or `callAIStream()` needs an `agentName` field added to its options. Here's the mapping:

| Edge Function | agentName |
|---|---|
| `agent-chat` | dynamic from request body (sales/support/accounting etc.) |
| `pipeline-ai` | `"sales"` |
| `draft-email` | `"email"` |
| `seo-ai-strategy` | `"seo"` |
| `daily-summary` | `"briefing"` |
| `generate-fix-prompt` | `"system"` |
| `ad-director-*` functions | `"ad-director"` |
| `estimation-*` functions | `"estimation"` |
| `social-*` functions | `"social"` |
| `support-*` functions | `"support"` |
| `accounting-*` functions | `"accounting"` |
| `legal-*` functions | `"legal"` |
| `shopfloor-*` functions | `"shopfloor"` |
| `delivery-*` functions | `"delivery"` |
| `growth-*` functions | `"growth"` |
| `commander-*` functions | `"commander"` |
| `empire-*` functions | `"empire"` |
| `bizdev-*` functions | `"bizdev"` |
| `data-*` functions | `"data"` |
| `talent-*` functions | `"talent"` |
| `webbuilder-*` functions | `"webbuilder"` |
| All others | contextual name matching function purpose |

Each change is a one-line addition (`agentName: "xxx"`) to the existing `callAI({...})` options object. No logic changes, no new files — just labeling.

## Scope
~47 files, each getting 1-3 lines added. After deployment, the "By Agent" chart will show a proper breakdown instead of "unknown".

