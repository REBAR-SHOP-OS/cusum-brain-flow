

# Smart Fuzzy Name Matching in Kiosk Registration

## Problem
Currently, when a new person types their name in the kiosk registration, it does an exact case-insensitive match (`ilike`). If someone types "Kourosh" instead of "Kourosh Zand", or "Ali" instead of "Ali Reza", the system creates a duplicate profile instead of linking to the existing one.

## Solution
Add a two-step flow: **fuzzy search → confirm/choose → register**

### 1. Backend: New edge function `kiosk-lookup` (lightweight, no clock-in)

A new edge function that takes a partial name and returns fuzzy matches from existing company profiles:

```sql
-- Uses ILIKE with wildcards: '%name%' pattern
-- Returns top 5 matches with id, full_name, avatar_url
```

The function will:
- Accept `{ name: string }` 
- Query `profiles` where `full_name ILIKE '%trimmedName%'` in the caller's company
- Also try splitting input and matching any word: e.g. "Kourosh" matches "Kourosh Zand"
- Return `{ candidates: [{ id, full_name, avatar_url }] }`

### 2. Frontend: `FirstTimeRegistration.tsx` — Add candidate selection step

**Flow change:**
1. User types name → clicks "Search" (or auto-search on 2+ chars)
2. Call `kiosk-lookup` → get candidates
3. **If candidates found**: Show cards: "Are you one of these people?" with each name + avatar, plus a "No, I'm new" button
4. **If user picks an existing profile**: Call `kiosk-register` with `{ name, faceBase64, existingProfileId: candidate.id }`
5. **If no candidates or "I'm new"**: Call `kiosk-register` as before (creates new profile)

### 3. Backend: Update `kiosk-register` to accept `existingProfileId`

If `existingProfileId` is provided, skip the name-matching logic and directly use that profile ID. This ensures the user's explicit choice is respected.

### Files Changed
- **New**: `supabase/functions/kiosk-lookup/index.ts` — fuzzy name search
- **Edit**: `supabase/functions/kiosk-register/index.ts` — accept optional `existingProfileId`
- **Edit**: `src/components/timeclock/FirstTimeRegistration.tsx` — add candidate selection UI step

