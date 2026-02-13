

# Fix: Remaining forwardRef Warnings (Batch)

## Problem
Seven components on the Home page trigger "Function components cannot be given refs" warnings. One additional warning comes from Radix UI's `DropdownMenu` which is a third-party library issue and cannot be fixed on our side.

## Components to Fix

| # | Component | File | Rendered by |
|---|-----------|------|-------------|
| 1 | `ChatInput` | `src/components/chat/ChatInput.tsx` | `Home` |
| 2 | `AutomationsSection` | `src/components/integrations/AutomationsSection.tsx` | `Home` |
| 3 | `AutomationCard` | `src/components/integrations/AutomationsSection.tsx` (internal) | `AutomationsSection` |
| 4 | `HelperCard` | `src/pages/Home.tsx` (internal) | `Home` |
| 5 | `IntelligencePanel` | `src/components/layout/IntelligencePanel.tsx` | `AppLayout` |
| 6 | `MobileNavV2` | `src/components/layout/MobileNavV2.tsx` | `AppLayout` |
| 7 | `LiveChatWidget` | `src/components/layout/LiveChatWidget.tsx` | `AppLayout` |

## Fix (same pattern for all)

Wrap each component with `React.forwardRef`, attach `ref` to the root element, and add `displayName`.

## Not Fixed

- `DropdownMenu` warning in `TopBar` -- this comes from `@radix-ui/react-dropdown-menu` internals and cannot be fixed in our code.

## Technical Details

### 1. `ChatInput` (line 33)
```tsx
export const ChatInput = React.forwardRef<HTMLDivElement, ChatInputProps>(
  function ChatInput(props, ref) { /* existing body, ref on root */ }
);
ChatInput.displayName = "ChatInput";
```

### 2-3. `AutomationsSection` and `AutomationCard`
Both in the same file. Wrap each with `forwardRef`.

### 4. `HelperCard` in `Home.tsx`
Wrap the local `HelperCard` function with `forwardRef`.

### 5-7. `IntelligencePanel`, `MobileNavV2`, `LiveChatWidget`
Same pattern -- wrap with `forwardRef`, attach ref to root element.

Seven components across five files. Zero functional changes.

