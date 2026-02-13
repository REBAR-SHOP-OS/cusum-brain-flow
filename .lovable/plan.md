

# Fix: Force Browser Cache Invalidation for forwardRef Fixes

## Problem
All seven components already have correct `forwardRef` implementations in the source code, but the browser preview is serving stale cached versions (visible from the unchanged `?t=1770959238518` timestamps in the error URLs). The HMR (Hot Module Replacement) did not pick up the structural changes from plain functions to `forwardRef`.

## Solution
Add a trivial comment to each affected file to force Vite to generate new cache-busting timestamps, causing the browser to load the updated code.

### Files to touch (add export comment at top of each):
1. `src/components/chat/ChatInput.tsx`
2. `src/components/integrations/AutomationsSection.tsx`
3. `src/pages/Home.tsx` (contains HelperCard)
4. `src/components/layout/IntelligencePanel.tsx`
5. `src/components/layout/MobileNavV2.tsx`
6. `src/components/layout/LiveChatWidget.tsx`

### What changes
A single comment line like `// forwardRef cache bust` added to the top of each file. Zero functional changes.

### Warnings that will remain (unfixable -- Radix UI library internals)
- `Tooltip` in `ChatInput` -- from `@radix-ui/react-tooltip`
- `DropdownMenu` in `TopBar` -- from `@radix-ui/react-dropdown-menu`

These are third-party library issues and cannot be resolved without updating the Radix UI packages.

