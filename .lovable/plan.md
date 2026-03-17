

## Plan: Fix Manual Add Item — Require Category & Show in Correct Group

### Problem
1. The **Add button** is only disabled when title is empty — it should also require a category selection
2. After adding, items with Office/Workshop category already appear under their group (via `categorizedCustom` prop), but the button enables too early

### Changes

**File: `src/components/purchasing/PurchasingListPanel.tsx`**

1. **Line 178** — Change `disabled={!newTitle.trim()}` to `disabled={!newTitle.trim() || !newCategory}` so Add is only active when both title and category are filled
2. That's it — the categorized display logic already works: `categorizedCustom` items are passed to `CompanyDefaultItems` which renders them under the correct Office/Workshop group

### Single-line fix
```typescript
// Line 178: before
<Button onClick={handleAdd} disabled={!newTitle.trim()}>Add</Button>

// Line 178: after
<Button onClick={handleAdd} disabled={!newTitle.trim() || !newCategory}>Add</Button>
```

