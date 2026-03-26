

# Add Inclusions/Exclusions from Estimation to Quote Notes

## Problem
The AI-generated quotation stores `assumptions` in metadata but doesn't populate the Notes/Terms field with standard inclusions/exclusions. The DraftQuotationEditor only reads `meta.notes` (a single string), missing the structured `assumptions` array.

## Changes

### 1. Backend: Add inclusions/exclusions to quote metadata (`supabase/functions/ai-generate-quotation/index.ts`)
Add explicit `inclusions` and `exclusions` arrays to the metadata object:
```ts
inclusions: [
  "Material supply (cut & bent rebar)",
  "Shop drawings",
  shouldIncludeShopDrawings ? "Shop drawing preparation included" : null,
  deliveryDistanceKm > 0 ? `Delivery within ${deliveryDistanceKm} km` : null,
  "Tagging and bundling per schedule",
].filter(Boolean),
exclusions: [
  "Installation labour",
  "Engineering stamps / sealed drawings",
  deliveryDistanceKm <= 0 ? "Delivery / shipping (distance TBD)" : null,
  "Crane / unloading at site",
  "Permits and inspections",
].filter(Boolean),
```

Also append inclusions/exclusions into the `notes` field so it pre-populates the editor:
```ts
notes: [
  `Prices valid for 30 days. All weights include ${scrapPct}% scrap.`,
  "",
  "INCLUSIONS:",
  ...inclusions.map(i => `✅ ${i}`),
  "",
  "EXCLUSIONS:",
  ...exclusions.map(e => `➖ ${e}`),
].join("\n"),
```

### 2. Frontend: Load assumptions/inclusions/exclusions into notes if notes is empty (`src/components/accounting/documents/DraftQuotationEditor.tsx`)
When loading quote metadata, if `notes` is empty but `assumptions`, `inclusions`, or `exclusions` arrays exist, build the notes string from them:
```ts
let resolvedNotes = meta.notes || "";
if (!resolvedNotes && (meta.inclusions || meta.exclusions || meta.assumptions)) {
  const parts: string[] = [];
  if (meta.inclusions?.length) {
    parts.push("INCLUSIONS:", ...meta.inclusions.map(i => `✅ ${i}`), "");
  }
  if (meta.exclusions?.length) {
    parts.push("EXCLUSIONS:", ...meta.exclusions.map(e => `➖ ${e}`), "");
  }
  if (meta.assumptions?.length) {
    parts.push("NOTES:", ...meta.assumptions.map(a => `• ${a}`));
  }
  resolvedNotes = parts.join("\n");
}
setNotes(resolvedNotes);
```

## Result
- New AI quotes will have inclusions/exclusions pre-filled in the Notes/Terms area
- Existing quotes with `assumptions` in metadata will also show them if notes was blank
- The QuotationTemplate print view already renders `inclusions`/`exclusions` arrays — this populates them

## Files Changed
- `supabase/functions/ai-generate-quotation/index.ts`
- `src/components/accounting/documents/DraftQuotationEditor.tsx`

