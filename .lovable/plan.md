

## Add 30s and 60s Duration Options to Video Generator

### Change
Add `30 seconds` and `60 seconds` duration options to all three model configurations in `VideoGeneratorDialog.tsx`.

### File: `src/components/social/VideoGeneratorDialog.tsx`

Update the `durationOptions` arrays for each model and increase `maxDuration`:

**Veo 3.1** (lines 40-45): Add 30s and 60s options, update `maxDuration` to 60
**Sora 2** (lines 53-58): Add 30s and 60s options, update `maxDuration` to 60  
**Sora 2 Pro** (lines 66-71): Add 30s and 60s options, update `maxDuration` to 60

Each model's `durationOptions` will become:
```typescript
durationOptions: [
  { value: "4", label: "4 seconds" },
  { value: "6", label: "6 seconds" },  // Veo only
  { value: "8", label: "8 seconds" },
  { value: "12", label: "12 seconds" }, // Sora only
  { value: "30", label: "30 seconds" },
  { value: "60", label: "60 seconds" },
],
```

Also update the edge function validation in `supabase/functions/generate-video/index.ts` — the `duration` max is currently `30`, needs to be raised to `60`.

### Files
1. `src/components/social/VideoGeneratorDialog.tsx` — Add duration options
2. `supabase/functions/generate-video/index.ts` — Update max duration validation

