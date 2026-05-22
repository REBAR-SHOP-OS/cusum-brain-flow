# Auto-Match Tag Photo Mode — Loading Station

Eliminate manual per-item photo capture. User takes one photo of a physical rebar tag; the system OCRs it, matches to a checklist item, attaches the photo, and marks it loaded — then auto-advances.

## Scope
File touched (frontend): `src/pages/LoadingStation.tsx` (top-bar toggle + new `AutoMatchPanel`).
New edge function: `supabase/functions/match-tag-photo/index.ts`.
Hook reused: `useLoadingChecklist` (existing `uploadPhoto` + `toggleLoaded`).
No schema changes. No changes to `LoadingItemCard`, `useCompletedBundles`, or `loading_checklist` table.

## UX Flow
1. New segmented toggle in the bundle header: **Manual** / **Auto Match Tag Photo** (default Manual; preference kept in component state only).
2. In Auto mode an `AutoMatchPanel` replaces the per-item Camera button row at the top (the item list remains visible below, read-only-styled but still toggle-able).
3. Big primary button "Capture Tag" → opens native camera (`<input capture="environment">`).
4. After capture: spinner "Reading tag…" → calls `match-tag-photo` edge function with the image + the current list of unmatched items.
5. Result handling:
   - **Confident match** (score ≥ 0.85, gap to runner-up ≥ 0.15): auto-upload photo to that item via existing `uploadPhoto`, flash green toast "Matched MARK 12B", scroll the matched card into view, advance focus to next unmatched. Card turns green (existing `isLoaded` styling).
   - **Uncertain** (0.55 ≤ best < 0.85, or close runner-up): show inline "Confirm match" card with top 3 candidates (mark, size, length, qty) + "Retake" button. On user tap → run `uploadPhoto` for chosen item.
   - **No match** (best < 0.55 or OCR empty): red banner "Couldn't read tag — retake or pick manually" + "Retake" + "Pick from list" buttons.
6. Progress strip shows "3 of 8 items loaded" (already exists) plus a small badge in Auto mode: "Last match: MARK 12B • 92%".
7. Uncertain matches render with amber border on candidate cards (warning state).

## Matching Logic (edge function)
`POST /match-tag-photo` body:
```json
{ "imageBase64": "...", "candidates": [{ "id", "mark_number", "bar_code", "cut_length_mm", "total_pieces", "asa_shape_code" }, ...] }
```
Steps:
1. Call Lovable AI Gateway (`google/gemini-3-flash-preview`) with structured-output tool call `extract_tag` → fields: `tag_number`, `mark`, `bar_size`, `length_mm`, `quantity`, `shape_code`, `raw_text`, `confidence_ocr`.
2. Score each candidate locally (deterministic, not LLM):
   - Mark match exact = +0.45, fuzzy (Levenshtein ≤1, case-insensitive) = +0.25.
   - Bar size match = +0.15.
   - Length within ±2% = +0.20, within ±5% = +0.10.
   - Quantity match = +0.10.
   - Shape code match = +0.10.
   - Cap at 1.0.
3. Return `{ ocr, ranked: [{id, score, reasons[]}], decision: "auto"|"confirm"|"none" }`.

Edge function is JWT-protected, uses `LOVABLE_API_KEY`, returns 429/402 errors plainly so the UI can toast them. No DB writes inside the function — the client owns `uploadPhoto`/`toggleLoaded` so existing RLS + checklist init flow is untouched.

## State Additions in LoadingStation
- `mode: "manual" | "auto"` (default `"manual"`).
- `autoState: "idle" | "capturing" | "reading" | "confirm" | "error"`.
- `lastMatch: { id, score, mark } | null`.
- `candidates: RankedCandidate[]` for the confirm view.

## Non-Goals
- No batch/multi-tag-in-one-photo support (single tag per capture).
- No new DB tables, no changes to `loading_checklist` schema or RLS.
- No changes to PickupStation, DeliveryTerminal, DeliveryOps in this pass.
- No offline queue; capture requires network.

## Validation
- Manual mode behavior unchanged (regression check: take photo on an item → still attaches).
- Auto mode: with a clear tag photo, end-to-end match → `loading_checklist` row gets `loaded=true` + `photo_path` set (verify via existing query in hook).
- Uncertain path: rejection of low-confidence keeps item un-loaded, no photo attached unless user confirms.
- Rate-limit (429) and payment (402) errors surface as toasts and leave state recoverable (back to `idle`).

Ready to implement on approval.
