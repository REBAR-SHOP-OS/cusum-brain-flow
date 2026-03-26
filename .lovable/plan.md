

# Name Cards Based on Prompt

## Problem
All cards show "Untitled Ad" or "{brand} Ad" because the project name is derived from the brand name, not the user's prompt.

## Changes

### 1. `src/lib/backgroundAdDirectorService.ts` (line 369)
Generate a short name from the user's prompt (first ~50 chars, trimmed to last word boundary):

```typescript
// Replace: name: brand.name ? `${brand.name} Ad` : "Untitled Ad",
const promptName = prompt.length > 50 ? prompt.substring(0, 50).replace(/\s+\S*$/, "…") : prompt;
name: promptName || (brand.name ? `${brand.name} Ad` : "Untitled Ad"),
```

### 2. `src/components/ad-director/AdDirectorContent.tsx` (line 620)
Use the user prompt for draft saves too. The `script` field in state holds the prompt:

```typescript
// Replace: name: brand.name || "Untitled",
const promptName = service.getState().userPrompt;
name: promptName
  ? (promptName.length > 50 ? promptName.substring(0, 50).replace(/\s+\S*$/, "…") : promptName)
  : (brand.name || "Untitled"),
```

### 3. `src/components/ad-director/AdDirectorContent.tsx` (line 252)
Same for the completed-video save:

```typescript
name: service.getState().userPrompt
  ? (service.getState().userPrompt!.length > 50 ? service.getState().userPrompt!.substring(0, 50).replace(/\s+\S*$/, "…") : service.getState().userPrompt!)
  : (service.getState().brand.name || "Untitled"),
```

## Result
Card names will show the first ~50 characters of the user's prompt (e.g., "A modern kitchen with sleek design and warm lighti…") instead of "Untitled Ad". Users can still rename via inline edit.

