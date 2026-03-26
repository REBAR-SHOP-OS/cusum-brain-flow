

# Hide User Prompt Bubble in Result View

## What
The user prompt bubble (showing "Product: wire_mesh. Style: inspirational. یک ویدیو بساز") is displayed in the result view. The user wants it hidden — the prompt should not be visible to the user in this section.

## Change

### `src/components/ad-director/AdDirectorContent.tsx`

Remove the user prompt bubble from the **result** section (lines 326-330):
```tsx
{/* User message */}
<div className="flex justify-end">
  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-3 text-sm">
    {userPrompt}
  </div>
</div>
```

Also remove the same bubble from the **analyzing/generating** section (lines 299-303) for consistency.

| File | Change |
|---|---|
| `src/components/ad-director/AdDirectorContent.tsx` | Remove `userPrompt` bubble divs from both "analyzing/generating" and "result" sections |

