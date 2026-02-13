

# Fix: forwardRef Warnings for AccountingAgent and AgentSuggestionCard

## Problem
Two remaining `forwardRef` warnings on the Accounting page:
1. `AccountingAgent` -- rendered in `AccountingWorkspace`
2. `AgentSuggestionCard` -- rendered in `AgentSuggestionsPanel`

Both are plain function components that receive refs from parent wrappers.

## Fix

### 1. `src/components/accounting/AccountingAgent.tsx`
Wrap with `React.forwardRef`. Since this component has many props and hooks, the simplest approach is to wrap the existing function:

```tsx
export const AccountingAgent = React.forwardRef<HTMLDivElement, AccountingAgentProps>(
  (props, ref) => { /* existing component body, add ref to root div */ }
);
AccountingAgent.displayName = "AccountingAgent";
```

### 2. `src/components/agent/AgentSuggestionCard.tsx`
Same pattern -- wrap with `React.forwardRef` and pass ref to the root `Card` element.

```tsx
export const AgentSuggestionCard = React.forwardRef<HTMLDivElement, AgentSuggestionCardProps>(
  (props, ref) => { /* existing body, pass ref to Card */ }
);
AgentSuggestionCard.displayName = "AgentSuggestionCard";
```

Two files, minimal changes, zero risk.

