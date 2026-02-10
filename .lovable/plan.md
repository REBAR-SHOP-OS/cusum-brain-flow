

## Ben's Personalized Daily Summarizer

Currently the Daily Summarizer shows a generic company-wide digest (financials, social media, production, ERP, etc.) that isn't relevant to Ben's estimating role. This plan makes it fully personalized for `ben@rebar.shop` with his 8 specific categories.

### What Changes

**1. Frontend hook (`src/hooks/useDailyDigest.ts`)** -- Pass the logged-in user's email to the edge function so it can personalize the response.

**2. Edge function (`supabase/functions/daily-summary/index.ts`)** -- When email is `ben@rebar.shop`, fetch Ben-specific data and use a custom AI prompt with his 8 categories:

| # | Category | What it fetches |
|---|----------|----------------|
| 1 | Emails | Communications to/from `ben@rebar.shop` and `estimation@rebar.shop` |
| 2 | Estimation Ben | Active leads assigned to Ben (open estimates, takeoffs, deadlines) |
| 3 | QC Ben | Leads/files with QC flags or validation issues tied to Ben |
| 4 | Addendums | Communications and lead files containing "addendum" or "revision" keywords |
| 5 | Estimation Karthick | Active leads assigned to Karthick for Ben's oversight |
| 6 | Shop Drawings | Lead files with "shop drawing" references, in-progress status |
| 7 | Shop Drawings for Approval | Lead files with "shop drawing" that are pending approval |
| 8 | Eisenhower | Ben's tasks, overdue items, recent emails, calls -- his priority matrix |

**3. Frontend display (`src/components/daily-digest/DigestContent.tsx`)** -- Add rendering for Ben's custom sections. The AI response will include a `benCategories` array (one object per category with title, items, urgentCount) that replaces the generic financial/social/production cards.

**4. Stats grid** -- For Ben, show relevant stats only: Emails, Estimates (Ben), QC Flags, Addendums, Estimates (Karthick), Shop Drawings, Pending Approval, Overdue Tasks.

### Technical Details

**Hook change** -- Get user email from auth and pass it:
```typescript
// useDailyDigest.ts
const { user } = useAuth();
supabase.functions.invoke("daily-summary", { 
  body: { date: isoDate, userEmail: user?.email } 
});
```

**Edge function** -- Add a `ben@rebar.shop` detection block after the generic data fetch:
```typescript
const { date, userEmail } = await req.json();

if (userEmail === "ben@rebar.shop") {
  // Fetch Ben-specific: his emails, his leads, Karthick's leads,
  // lead_files for addendums/shop drawings, tasks, overdue items
  // Use a Ben-specific AI prompt with 8 categories
  // Return { digest: { benCategories: [...], ... }, stats: { ... } }
}
```

The Ben-specific AI prompt instructs the model to return JSON with:
- `benCategories`: array of 8 objects, each with `title`, `icon`, `items` (array of summaries), `urgentCount`
- Plus the standard `greeting`, `affirmation`, `keyTakeaways`, `calendarEvents`, `tipOfTheDay`

**DigestContent** -- Detect `benCategories` in the digest and render category cards with urgency badges instead of the generic financial/social/production sections.

**DigestStats type** -- Add optional Ben-specific stat fields: `estimatesBen`, `qcFlags`, `addendums`, `estimatesKarthick`, `shopDrawings`, `pendingApproval`, `overdueTasks`.

