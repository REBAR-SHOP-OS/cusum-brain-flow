

## Fix Grammar Check and Apply It to All Text Boxes

### Root Cause

The grammar check error **"Could not reach grammar checker"** is caused by an **exhausted OpenAI quota**. The `grammar-check` edge function calls OpenAI's `gpt-4o-mini` via `GPT_API_KEY`, which returns a `429 insufficient_quota` error.

### Solution Overview

Two changes:

1. **Fix the grammar-check function** -- switch from OpenAI (broken quota) to Lovable AI gateway (free, no API key needed)
2. **Apply grammar check to ALL text boxes** -- merge the SmartTextarea check button into the base `Textarea` component so all 64+ files get it automatically

### Changes

#### 1. Edge function: switch to Lovable AI gateway (`supabase/functions/grammar-check/index.ts`)

Replace the `callAI` import and OpenAI call with a direct fetch to the Lovable AI gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) using `LOVABLE_API_KEY` (already configured). This eliminates the dependency on the exhausted OpenAI quota.

- Remove the import of `callAI` from `_shared/aiRouter.ts`
- Call the Lovable AI gateway directly with `google/gemini-2.5-flash-lite` (fast, cheap, perfect for grammar fixes)
- Handle 429/402 rate limit errors gracefully

#### 2. Merge grammar check into base Textarea (`src/components/ui/textarea.tsx`)

Move the grammar-check button logic from `SmartTextarea` directly into the base `Textarea` component:

- Wrap the textarea in a `relative` div
- Add the "Check" button (same as SmartTextarea) that appears when text length > 2 characters
- The button calls the `grammar-check` edge function and fires a synthetic change event
- This automatically gives grammar check to ALL 64+ files that use `<Textarea>`

#### 3. Remove SmartTextarea (`src/components/ui/SmartTextarea.tsx`)

Since the base Textarea now has grammar check built in, SmartTextarea becomes redundant.

#### 4. Update all SmartTextarea imports (13 files)

Replace `SmartTextarea` imports with plain `Textarea` imports in all 13 files that currently use it:
- `src/components/pipeline/LeadTimeline.tsx`
- `src/components/teamhub/MessageThread.tsx`
- `src/components/inbox/EmailTemplatesDrawer.tsx`
- `src/components/inbox/InboxManagerSettings.tsx`
- `src/components/inbox/ComposeEmailDialog.tsx`
- `src/components/inbox/EmailReplyComposer.tsx`
- `src/components/social/ImageGeneratorDialog.tsx`
- `src/pages/Tasks.tsx`
- And remaining files using SmartTextarea

### Technical Details

**Grammar-check edge function (new implementation):**
```text
Request flow:
  Client -> grammar-check edge function -> Lovable AI Gateway (gemini-2.5-flash-lite) -> Response
                                           Uses LOVABLE_API_KEY (auto-provisioned)
```

**Base Textarea component (enhanced):**
```text
+----------------------------------+
| [textarea content area]          |
|                                  |
|                     [Check btn]  |
+----------------------------------+
```

The check button only appears when the textarea has a controlled `value` prop with 3+ characters. Uncontrolled textareas (no `value` prop) won't show the button, keeping backward compatibility.

