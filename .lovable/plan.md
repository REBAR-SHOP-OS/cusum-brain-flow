## Clearance Archive — Auto + Manual

A new **Archive** tab inside the Clearance station that shows every cleared evidence record (Auto and Manual) as side-by-side tag + product photo cards, filterable by project, manifest, date range, and operator.

### Where it lives

`src/pages/ClearanceStation.tsx` currently has two states: project list, and active manifest. Add a top-level tab switcher on the project-list view:

- **Manifests** (current behavior — pick a manifest to clear)
- **Archive** (new — read-only history)

The Archive tab is only visible on the list view, not inside an active manifest or Auto Mode, so it never interferes with the live workflow.

### What gets shown

Every `clearance_evidence` row where `status = 'cleared'` and both photos are attached, scoped by the existing RLS (company-isolated already — no new policies needed).

For each row the card shows:

```text
┌──────────────────────────────────────────┐
│  [TAG PHOTO]        [PRODUCT PHOTO]      │
│                                          │
│  MARK A1501  ·  15M  ·  4318 mm  ·  7pc  │
│  Manifest: WALDEN-REV2                   │
│  Project:  Walden Homes / Gensco         │
│  Cleared:  May 27, 2026 · 14:32          │
│  By:       Sattar Esmaeili-Oureh  ·  AUTO│
└──────────────────────────────────────────┘
```

Photos use signed URLs from the existing `clearance-photos` bucket (the same `createSignedUrl` flow used by `validate-clearance-photo`). Click a card → lightbox to view both at full size.

### Filters (top of Archive tab)

- **Project** — dropdown from distinct projects in the result set
- **Manifest** — dropdown from distinct cut-plans (filtered by project when one is selected)
- **Date range** — shadcn date-range picker (default: last 30 days)
- **Operator** — dropdown of distinct `verified_by` profiles

Filters compose; clearing one widens the result. A small "X cleared items" count sits next to the filters.

### Data layer

New hook `src/hooks/useClearanceArchive.ts`:

- Joins `clearance_evidence` → `cut_plan_items` → `cut_plans` → `projects` → `profiles` (verifier name) using the same join shape already proven in `useClearanceData`.
- Filters server-side by `status='cleared'`, `verified_at` range, optional `project_id`, `cut_plan_id`, `verified_by`.
- Returns rows already enriched with mark/size/length/qty/manifest/project/operator/verification method.
- Lazily resolves signed photo URLs in batches when cards mount (intersection observer) to avoid 1000× signed-URL calls up front.
- Pagination: 50 rows/page, "Load more" button (no infinite scroll, easier for kiosks).

### Files to add / touch

- **New** `src/hooks/useClearanceArchive.ts` — query + filter state
- **New** `src/components/clearance/ClearanceArchive.tsx` — tabs body: filter bar + card grid + lightbox
- **New** `src/components/clearance/ArchiveCard.tsx` — single row UI (tag + product side-by-side, metadata)
- **Edit** `src/pages/ClearanceStation.tsx` — add Manifests/Archive tab switcher on the list view only

### What does NOT change

- No DB migration. Existing `clearance_evidence` RLS (company-scoped via `clearance_evidence_company_check`) already restricts the archive to the operator's company.
- No changes to Auto Mode, Manual Mode, OCR, validation, finalize, or the hard gate that both photos must live on the same row.
- No changes to the storage bucket or its policies.
- Manifests tab keeps current behavior, layout, and routing.

### Edge cases handled

- Rows where one photo is missing (legacy) — show a "photo missing" placeholder rather than hiding the row, so audits stay honest.
- Verifier deleted (FK `SET NULL`) — show "Unknown operator".
- Project/manifest deleted — show "(archived)" but still render the photos and metadata.
- Date range default 30 days keeps initial load small on a busy shop.
