

# Max-Equip All Agents and Fix Landing Chat Widget

## What's Wrong

1. **Landing page chat widget (circled)**: React throws a "Function components cannot be given refs" warning. The `PublicChatWidget` is not wrapped in `forwardRef`, causing console noise.

2. **Missing agent quick-start suggestions**: The `agentSuggestionsData.ts` file is missing entries for `legal` and `empire` (empire exists but could use more). When users open these agents, they see no helpful starter prompts.

3. **Agent router gaps**: The smart router (`agentRouter.ts`) is missing the `empire` agent entirely -- typing "venture", "diagnose", "architect" won't route to the right agent.

4. **`commander` agent type exists** in the AgentType union but has no config, no route, and no suggestions -- dead code that could cause fallback errors.

5. **Landing page stat** says "17 AI Agents" but there are actually 19 configured agents.

---

## Fix Plan

### 1. Fix PublicChatWidget ref warning
**File**: `src/components/landing/PublicChatWidget.tsx`
- Wrap the component in `React.forwardRef` (matching the pattern used by `FloatingVizzyButton` and `AgentSuggestionCard`).

### 2. Add missing agent suggestions
**File**: `src/components/agent/agentSuggestionsData.ts`
- Add `legal` entry with starter prompts (contract review, lien advice, compliance questions).
- Ensure `empire` entry has robust prompts for venture building, diagnostics, and cross-platform fixes.

### 3. Add empire route to agent router
**File**: `src/lib/agentRouter.ts`
- Add an `empire` entry with keywords: "venture", "architect", "diagnose", "cross-platform", "aria", "empire", "odoo", "wordpress fix", "stress test", "meta-builder".

### 4. Clean up commander type
**File**: `src/lib/agent.ts`
- Keep `commander` in the AgentType union (it's used by the backend edge function), but no frontend changes needed since it routes through the sales commander config on the backend.

### 5. Update landing page stat
**File**: `src/pages/Landing.tsx`
- Change "17" to "19" for the AI Agents counter to reflect the actual count.

---

## Technical Details

### PublicChatWidget.tsx
Wrap the existing function component:
```typescript
export const PublicChatWidget = React.forwardRef<HTMLDivElement, {}>(
  function PublicChatWidget(_props, ref) {
    // ... existing code, wrap outer fragment in a div with ref
  }
);
PublicChatWidget.displayName = "PublicChatWidget";
```

### agentSuggestionsData.ts -- New Entries
```typescript
legal: [
  { title: "Review a contract clause for risks", category: "Contracts" },
  { title: "What are my construction lien rights in Ontario?", category: "Liens" },
  { title: "Check OHSA compliance requirements", category: "Compliance" },
],
```

### agentRouter.ts -- Empire Route
```typescript
{
  id: "empire",
  route: "/agent/empire",
  name: "Architect",
  keywords: [
    "venture", "ventures", "architect", "empire", "diagnose",
    "cross-platform", "meta-builder", "stress test", "odoo",
    "wordpress fix", "aria", "build a business", "platform commander",
  ],
}
```

### Landing.tsx
```typescript
{ value: 19, suffix: "", label: "AI Agents", prefix: "" },
```
