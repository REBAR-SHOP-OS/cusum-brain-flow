

# Fix: ReactMarkdown forwardRef Warning in AccountingAgent

## Problem
The `ReactMarkdown` component from `react-markdown` v10 does not support `forwardRef`. When React's reconciler attempts to pass a ref, it triggers the warning. This is a known issue with `react-markdown` v10.

## Fix
Replace the raw `ReactMarkdown` usage in `AccountingAgent.tsx` with the project's existing `RichMarkdown` component, which already wraps `ReactMarkdown` in a proper `div` container. This eliminates the ref warning and also gives Penny's messages the same rich styling (status badges, styled tables, etc.) used elsewhere.

### Technical Detail

**File: `src/components/accounting/AccountingAgent.tsx`**

1. Replace the `react-markdown` and `remark-gfm` imports with `RichMarkdown`:
   - Remove: `import ReactMarkdown from "react-markdown"` and `import remarkGfm from "remark-gfm"`
   - Add: `import { RichMarkdown } from "@/components/chat/RichMarkdown"`

2. Replace the rendering block (lines 371-374):
   ```tsx
   // Before
   <div className="prose prose-sm dark:prose-invert max-w-none ...">
     <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
   </div>

   // After
   <RichMarkdown content={msg.content} />
   ```

One file, two changes. The `RichMarkdown` component already handles all markdown rendering with proper DOM wrapping, so no ref is ever passed to the `ReactMarkdown` function component.

