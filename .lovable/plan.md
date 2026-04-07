

# Add Icons to Big Cut Length Display

## Goal
Add a scissors (record strike) icon on the left side and a ruler (length) icon on the right side of the large "1300 MM" cut length display, as annotated in the screenshot.

## Change

### `src/components/shopfloor/CutterStationView.tsx` (lines 874-884)
Convert the `CardContent` layout from pure `text-center` to a flex row with the number centered and icons on each side:

```tsx
<CardContent className="py-8 px-6">
  <p className="text-[10px] text-muted-foreground tracking-[0.3em] uppercase font-medium mb-2 text-center">
    Cut Each Piece To
  </p>
  <div className="flex items-center justify-center gap-4">
    <Scissors className="w-10 h-10 text-primary shrink-0" />
    <p className="text-7xl sm:text-8xl lg:text-9xl font-black font-mono text-foreground leading-none tracking-tight">
      {currentItem.cut_length_mm}
    </p>
    <Ruler className="w-10 h-10 text-primary shrink-0" />
  </div>
  <p className="text-sm text-primary tracking-[0.35em] uppercase mt-3 font-bold text-center">
    MM
  </p>
</CardContent>
```

- `Scissors` and `Ruler` are already imported — no new dependencies
- Single file, ~10 lines changed

