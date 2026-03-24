

## Add Auto-Fix Code Button to Vizzy Fix Requests

### What
Add a new button to each fix request card that combines the existing "Generate Lovable Command" flow with an automatic clipboard copy + opens the Lovable chat URL — making the fix process one-click instead of three steps (generate → view dialog → copy).

### How It Works
1. Clicking the new "Auto Fix" button (a `Wand2` icon) on a fix request card will:
   - Call `generate-fix-prompt` edge function (same as existing Sparkles button)
   - Automatically copy the generated prompt to clipboard
   - Show a toast with "Fix command copied — paste in Lovable chat"
   - Auto-resolve the fix request after successful generation

This replaces the current 3-step manual flow (Sparkles → Dialog → Copy) with a single click.

### Changes

**File**: `src/components/ceo/FixRequestQueue.tsx`

1. Add a new `handleAutoFix` function:
   ```typescript
   const handleAutoFix = async (req: FixRequest) => {
     setGeneratingId(req.id);
     try {
       const result = await invokeEdgeFunction<{ prompt: string }>("generate-fix-prompt", {
         title: req.affected_area || "Fix Request",
         description: req.description,
         screenshots: req.photo_url ? [req.photo_url] : [],
         priority: classifySeverity(req.description),
         source: "vizzy_auto_fix",
       });
       await navigator.clipboard.writeText(result.prompt);
       toast.success("Fix command copied to clipboard — paste in Lovable chat");
       // Auto-resolve after successful generation
       await resolveRequest(req.id);
     } catch (err: any) {
       toast.error("Auto-fix failed", { description: err.message });
     } finally {
       setGeneratingId(null);
     }
   };
   ```

2. Add the auto-fix button in the action buttons area (line ~317), before the existing Sparkles button:
   ```tsx
   <button
     onClick={() => handleAutoFix(req)}
     disabled={generatingId === req.id}
     className="p-1.5 rounded-md hover:bg-muted transition-colors text-emerald-500 hover:text-emerald-400 disabled:opacity-50"
     title="Auto-fix: generate & copy fix command"
   >
     <Wand2 className={`w-3.5 h-3.5 ${generatingId === req.id ? "animate-spin" : ""}`} />
   </button>
   ```

### Files Changed

| File | Change |
|---|---|
| `src/components/ceo/FixRequestQueue.tsx` | Add `handleAutoFix` function + Wand2 button per card for one-click fix generation |

