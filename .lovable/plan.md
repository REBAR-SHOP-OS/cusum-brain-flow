

## Update PLATFORM_PAGES to Include All Connected Pages

### Current State
The `PLATFORM_PAGES` in `PostReviewPanel.tsx` is incomplete. The database (`user_meta_tokens`) shows **6 Facebook pages** and **6 Instagram accounts** but the code only lists 3 Facebook and 2 Instagram pages.

### Database Reality

| Platform | Pages |
|----------|-------|
| **Facebook** | Ontario Steel Detailing, Rebar.shop, Ontario Digital Marketing, Ontario Logistics, Ontario Steels, Rebar.shop Ontario |
| **Instagram** | ontariosteeldetailing, rebar.shop, ontariodigitalmarketing, ontariologistics.ca, ontariosteels.ca, rebar.shop_on |
| **LinkedIn** | (no tokens in DB) |
| **YouTube** | (no tokens in DB) |
| **TikTok** | (no tokens in DB) |

### Change in `src/components/social/PostReviewPanel.tsx`

Update `PLATFORM_PAGES` (lines 52-79) to include all 6 pages for Facebook and all 6 for Instagram. Keep LinkedIn/YouTube/TikTok with their current single entry since they have no connected tokens yet.

```typescript
const PLATFORM_PAGES: Record<string, SelectionOption[]> = {
  facebook: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Rebar.shop", label: "Rebar.shop" },
    { value: "Ontario Digital Marketing", label: "Ontario Digital Marketing" },
    { value: "Ontario Logistics", label: "Ontario Logistics" },
    { value: "Ontario Steels", label: "Ontario Steels" },
    { value: "Rebar.shop Ontario", label: "Rebar.shop Ontario" },
  ],
  instagram: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Rebar.shop", label: "Rebar.shop" },
    { value: "Ontario Digital Marketing", label: "Ontario Digital Marketing" },
    { value: "Ontario Logistics", label: "Ontario Logistics" },
    { value: "Ontario Steels", label: "Ontario Steels" },
    { value: "Rebar.shop Ontario", label: "Rebar.shop Ontario" },
  ],
  instagram_fb: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Rebar.shop", label: "Rebar.shop" },
    { value: "Ontario Digital Marketing", label: "Ontario Digital Marketing" },
    { value: "Ontario Logistics", label: "Ontario Logistics" },
    { value: "Ontario Steels", label: "Ontario Steels" },
    { value: "Rebar.shop Ontario", label: "Rebar.shop Ontario" },
  ],
  linkedin: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Ontario Logistics", label: "Ontario Logistics" },
  ],
  linkedin_org: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
  ],
  youtube: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
  ],
  tiktok: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
  ],
};
```

Also update the same mapping in `SettingsSheet.tsx` (`defaultConnectedPages`) to reflect the same 6 pages for Facebook and Instagram.

### Single file change, no backend modifications needed.

