

## Hide Generic Company Sections for Ben

Ben's personalized digest already shows his 8 custom categories, but the generic company-wide sections (Financial Snapshot, Social Media, Employee Report, Production Report, ERP Activity, Email Digest, Meetings, Phone Calls) still appear below them because the edge function returns that data too.

### What Changes

**File: `src/components/daily-digest/DigestContent.tsx`**

Wrap all generic company sections (lines 139-489) in a single conditional check: only render them when `benCategories` is NOT present. This means:

- Financial Snapshot -- hidden for Ben
- Social Media Digest -- hidden for Ben
- Employee Report -- hidden for Ben
- Production Report -- hidden for Ben
- ERP Activity -- hidden for Ben
- Email Digest (generic) -- hidden for Ben (his emails are in benCategories)
- Meeting Summaries -- hidden for Ben
- Phone Calls -- hidden for Ben

Ben will only see: Date/Greeting, his 8-stat grid, Affirmation, Key Takeaways, his 8 Category Cards, Calendar Events, Tip of the Day, and the Random Fact.

**File: `supabase/functions/daily-summary/index.ts`**

As a backend optimization, skip fetching generic company data (financials, social media, production, ERP, employee report) when the user is `ben@rebar.shop`. This reduces unnecessary API calls and speeds up Ben's digest generation.

### Technical Detail

In DigestContent.tsx, add `!digest.benCategories` guard around all generic sections:

```typescript
{!digest.benCategories && (
  <>
    {/* Financial Snapshot */}
    {digest.financialSnapshot && ( ... )}
    {/* Social Media */}
    {digest.socialMediaDigest && ( ... )}
    {/* Employee Report */}
    {digest.employeeReport && ( ... )}
    {/* Production Report */}
    {digest.productionReport && ( ... )}
    {/* ERP Activity */}
    {digest.erpActivity && ( ... )}
    {/* Email Digest (generic) */}
    {digest.emailCategories && ( ... )}
    {/* Meeting Summaries */}
    {digest.meetingSummaries && ( ... )}
    {/* Phone Calls */}
    {digest.phoneCalls && ( ... )}
  </>
)}
```

No other files change. Calendar events, tip of the day, and random fact remain visible for all users.
