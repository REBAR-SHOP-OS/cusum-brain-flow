

# Vizzy Brain Panel — Department-Based Accordion Layout

## Problem
Currently the Brain Panel shows a flat list of memory cards with category filter chips. The user wants a structured, department-based view where each system section is a collapsible accordion, showing all related knowledge inside it.

## Design

Replace the flat card list + category chips with an **Accordion** layout. Each accordion section represents a department/system area. Memory entries are grouped into their department accordion.

```text
┌─────────────────────────────────┐
│ 🧠 Vizzy Brain (45 memories)   │  [Analyze Now]  ✕
├─────────────────────────────────┤
│ ▼ 💰 Revenue & Sales (8)       │
│   ├─ [Insight card - editable]  │
│   ├─ [Insight card - editable]  │
│   └─ ...                        │
│ ▶ 🏭 Operations & Production(12)│
│ ▶ 📞 Support & Communications(6)│
│ ▶ 📈 Growth & Marketing (5)     │
│ ▶ 🤖 AI & System Audits (9)    │
│ ▶ 📌 General (5)               │
└─────────────────────────────────┘
```

## Department Mapping

Map existing `category` values to departments:

| Department | Icon | Categories |
|---|---|---|
| Revenue & Sales | 💰 | `benchmark`, `brain_insight` (sales-related) |
| Operations & Production | 🏭 | `auto_fix`, `pre_digest` |
| Support & Communications | 📞 | `call_summary`, `voicemail_summary`, `feedback_patch` |
| Growth & Marketing | 📈 | (social/growth entries) |
| AI & System Audits | 🤖 | `agent_audit`, `brain_insight` |
| General | 📌 | `general`, and any unmatched |

Since `brain_insight` entries cover multiple departments and we can't reliably split them by content, we'll group by **category directly** as the accordion sections — each category becomes its own collapsible section. This is accurate and doesn't require guessing.

## Changes

### `src/components/vizzy/VizzyBrainPanel.tsx`
- Remove the category filter chips row
- Replace flat memory list with `Accordion` (from `src/components/ui/accordion.tsx`)
- Group entries by category using `CATEGORY_LABELS`
- Each `AccordionItem`: trigger shows icon + label + count, content shows the MemoryCard list
- Use `type="multiple"` so multiple sections can be open
- Keep MemoryCard component as-is (edit/delete)
- Keep header with Analyze Now button

### No changes to `useVizzyMemory.ts`
The hook already returns entries and categories — just need to group them in the UI.

## Technical Detail

```tsx
// Group entries by category
const grouped = entries.reduce((acc, entry) => {
  const cat = entry.category;
  if (!acc[cat]) acc[cat] = [];
  acc[cat].push(entry);
  return acc;
}, {} as Record<string, VizzyMemoryEntry[]>);

// Render
<Accordion type="multiple" className="w-full">
  {Object.entries(grouped).map(([cat, items]) => (
    <AccordionItem key={cat} value={cat}>
      <AccordionTrigger>
        {getCategoryLabel(cat)} ({items.length})
      </AccordionTrigger>
      <AccordionContent>
        {items.map(entry => <MemoryCard ... />)}
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

Single file change, ~30 lines modified.

