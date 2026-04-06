

# مرتب‌سازی کارت‌ها فقط بر اساس طول (بدون گروه‌بندی سایز)

## مشکل فعلی
سه فایل ابتدا بر اساس bar size گروه‌بندی می‌کنند (10M قبل از 15M)، سپس درون هر گروه بر اساس طول نزولی مرتب می‌کنند. نتیجه: 10M با طول 2040 بالای 15M با طول 9660 قرار می‌گیرد.

## تغییرات

### 1. `src/components/office/TagsExportView.tsx`
حذف گروه‌بندی بر اساس `bar_size` — فقط sort بر اساس `total_length_mm` نزولی:
```typescript
const sortedRows = useMemo(() => {
  return [...rows].sort((a, b) => 
    (b.total_length_mm || 0) - (a.total_length_mm || 0)
  );
}, [rows, sortMode]);
```

### 2. `src/pages/PrintTags.tsx`
همان تغییر — حذف گروه‌بندی سایز، فقط sort نزولی طول:
```typescript
const sortedRows = useMemo(() => {
  return [...rows].sort((a, b) => 
    (b.total_length_mm || 0) - (a.total_length_mm || 0)
  );
}, [rows, sortMode]);
```

### 3. `src/hooks/useStationData.ts` (Shop Floor)
Sort آیتم‌ها درون هر bar size group **از قبل نزولی هست** و درست کار می‌کند. بدون تغییر.

### نتیجه
- Office Tools و Print Tags: کارت‌ها از بلندترین به کوتاه‌ترین بدون توجه به سایز
- Shop Floor: بدون تغییر (گروه‌بندی بر اساس سایز در آنجا منطقی است)

