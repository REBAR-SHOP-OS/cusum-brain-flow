

# Auto-Configure Domain "rebar.shop" + Domain Setup UI

The SEO dashboard shows "No domain configured" because the `seo_domains` table is empty and there's no UI to add one. This plan adds a domain setup form and auto-inserts `rebar.shop`.

---

## Changes

### 1. SeoOverview.tsx -- Add Domain Setup Form

Replace the empty "No domain configured" card with a proper setup form:

- Input field for domain name (pre-filled with `rebar.shop`)
- Optional GA4 property ID input
- "Set Up Domain" button that inserts into `seo_domains`
- On success, invalidate the `seo-domain` query so the dashboard loads immediately
- Uses the user's `company_id` from the existing `useCompanyId` hook

### 2. Insert Logic

When the user clicks "Set Up Domain":
- Insert a row into `seo_domains` with `domain = "rebar.shop"`, `company_id` from profile, `gsc_verified = false`, `verified_ga = false`
- Invalidate all SEO queries to refresh the UI
- Show success toast

### 3. Domain Management

- Add a small settings area (visible when domain IS configured) showing the current domain with an option to update GA property ID
- Keep it minimal -- just domain name display + edit capability

---

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `src/components/seo/SeoOverview.tsx` | Replace "No domain configured" card with a setup form using Input + Button. Import `useCompanyId` hook and `Input` component. Add mutation to insert into `seo_domains`. |

### Setup Form Fields

- **Domain**: text input, default "rebar.shop"
- **GA4 Property ID**: optional text input, placeholder "properties/123456789"
- **Submit button**: "Set Up Domain"

No database changes needed -- `seo_domains` table already has all required columns with sensible defaults.

