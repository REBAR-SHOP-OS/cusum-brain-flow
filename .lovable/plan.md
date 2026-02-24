

## Remove Floating Microphone Button from `/shop-floor`

### Investigation Result
The floating red microphone button ("TAP TO SPEAK") comes from `src/components/shopfloor/VoiceRecorderWidget.tsx`. This component renders a `fixed bottom-6 right-6 z-50` button with a large red mic icon.

After thorough search, this component is **not imported or used anywhere** in the codebase -- not in `ShopFloor.tsx`, not in `AppLayout.tsx`, and not in any other file. What you're seeing is likely a stale build artifact or cached version.

### Change
**Delete file: `src/components/shopfloor/VoiceRecorderWidget.tsx`**

Remove this unused component entirely to:
- Eliminate the dead code from the build
- Prevent accidental future re-import
- Ensure the floating mic button never appears again

No other files need modification since nothing imports this component.

### What is NOT touched
- ShopFloor page layout and cards
- AppLayout and its floating buttons (Vizzy, Screenshot Feedback)
- Any other UI, logic, or database components
- Speech-to-text functionality in other parts of the app (e.g., feedback modal mic)
