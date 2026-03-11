

## Show Account Names Inside Platform Group Cards

### What
Each platform group card currently shows the count badge (×6) but doesn't tell you *which accounts* those posts belong to. Add a list of unique `page_name` values inside each card so you can see at a glance which accounts have scheduled posts.

### Changes

**`src/components/social/SocialCalendar.tsx`**

Inside the platform group card rendering (lines 184-203), after the title line:

1. Collect unique `page_name` values from the grouped posts: `const uniquePages = [...new Set(posts.map(p => p.page_name).filter(Boolean))]`
2. Render them as small muted text lines below the title, e.g.:
   - "Ontario Steel Detailing"
   - "CuSum Engineering"
3. Each page name shown in `text-[10px] text-muted-foreground truncate` style
4. If no `page_name` exists on any post, this section is simply not rendered

### UI Result
```text
┌─────────────────────┐
│ [FB] ×6             │
│ True structural int…│
│  · Ontario Steel    │
│  · CuSum Eng        │
│ Scheduled           │
└─────────────────────┘
```

