

# Add Privacy Notice Below Camera Feed in Kiosk Mode

## What
Add an informational text below the date/time line in the kiosk view, informing users that their photo and name are stored in the app's memory for clock-in/clock-out purposes.

## Change

**File:** `src/pages/TimeClock.tsx` — line 342

After the date/time `<p>` tag, add a notice text in both Persian and English:

```tsx
<p className="text-xs text-muted-foreground mt-6">{format(now, "EEEE, MMMM d, yyyy · h:mm a")}</p>
<p className="text-[10px] text-muted-foreground/60 mt-2 text-center max-w-md leading-relaxed">
  Your photo and name are securely stored in this app's memory for clock-in and clock-out purposes.
  <br />
  عکس و نام شما در حافظه این برنامه برای ثبت ورود و خروج ذخیره می‌شود.
</p>
```

This is a single-line addition — no logic changes needed.

