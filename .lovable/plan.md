

# مرتب‌سازی کارت‌ها بر اساس طول (بزرگ‌ترین به کوچک‌ترین)

## تغییرات

### 1. فایل: `src/hooks/useStationData.ts` (Shop Floor)
در بخش گروه‌بندی (خط ~203)، بعد از ساخت `bendItems` و `straightItems`، هر دو آرایه را بر اساس `cut_length_mm` نزولی sort کنم:

```typescript
groups.push({
  barCode: key,
  bendItems: g.bend.sort((a, b) => (b.cut_length_mm || 0) - (a.cut_length_mm || 0)),
  straightItems: g.straight.sort((a, b) => (b.cut_length_mm || 0) - (a.cut_length_mm || 0)),
});
```

### 2. فایل: `src/components/office/TagsExportView.tsx` (Office Tools)
در `sortedRows` useMemo (خط ~101-110)، ترتیب sort by length را از صعودی به نزولی تغییر دهم. همچنین حالت `standard` هم نزولی شود:

```typescript
const sortedRows = useMemo(() => {
  return [...rows].sort((a, b) => {
    const sizeA = a.bar_size_mapped || a.bar_size || "";
    const sizeB = b.bar_size_mapped || b.bar_size || "";
    if (sizeA !== sizeB) return sizeA.localeCompare(sizeB);
    return (b.total_length_mm || 0) - (a.total_length_mm || 0); // DESC
  });
}, [rows, sortMode]);
```

### نتیجه
- کارت‌ها در Shop Floor: درون هر bar size group، از بلندترین به کوتاه‌ترین
- کارت‌ها در Office Tools (Tags & Export): همیشه از بلندترین به کوتاه‌ترین

