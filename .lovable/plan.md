

## Restrict Chat Templates for External Users

### Summary

External users (non-`@rebar.shop` emails) must only see two specific templates: "Days I cannot attend" and "Sick days". All other templates are hidden. Internal users see everything unchanged.

### What Changes

**Single file: `src/components/chat/QuickTemplates.tsx`**

1. Import `useAuth` from `@/lib/auth`
2. Define a separate `externalTemplates` array with just the two allowed items:
   - "Days I cannot attend (must be reported at least 2 days in advance)"
   - "Sick days"
3. In the component, read the user's email, check if it ends with `@rebar.shop`
4. Render `externalTemplates` for external users, the existing `templates` for internal users

### Code Change

```typescript
import { useAuth } from "@/lib/auth";

const templates = [
  // ... existing 6 templates unchanged
];

const externalTemplates = [
  {
    label: "Days I cannot attend",
    text: "Days I cannot attend (must be reported at least 2 days in advance)"
  },
  {
    label: "Sick days",
    text: "Sick days"
  },
];

export function QuickTemplates({ onSelect, disabled }: QuickTemplatesProps) {
  const { user } = useAuth();
  const isInternal = user?.email?.endsWith("@rebar.shop") ?? false;
  const visibleTemplates = isInternal ? templates : externalTemplates;

  // ... render visibleTemplates instead of templates
}
```

### What Is NOT Changed
- No database changes
- No backend/edge function changes
- No UI design changes (same dropdown, same styling)
- Internal users see all 6 original templates exactly as before

