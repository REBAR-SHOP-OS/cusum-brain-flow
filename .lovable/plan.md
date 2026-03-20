
## Plan: Clean Up ChatPromptBar Bottom Bar

### Changes

**File: `src/components/ad-director/ChatPromptBar.tsx`**

1. **Remove the Paperclip (attach) button** and its associated hidden file input, `fileRef`, `handleFileChange`, `removeImage`, `images` state, and the extra image previews section
2. **Group Ratio and Duration pills together** with labels, separated by a small divider, into a single clean row:

```text
[Ratio: 16:9 | 9:16 | 1:1 | 4:3]  [Duration: 15s | 30s | 1min]  [→]
```

Each group gets a small label ("Ratio" / "Duration") above or beside it for clarity. Remove the `images` parameter from `onSubmit` (pass empty array for backward compat).

### Summary
- Remove: Paperclip icon, file upload input, extra image previews, related state
- Keep: Intro/Outro uploads (they serve the image upload purpose), ratio pills, duration pills, send button
- Add: Small text labels on each pill group for better visual organization
