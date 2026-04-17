

## وضعیت فعلی — قابلیت drag & drop **در حال حاضر وجود دارد** ولی باگ دارد

بررسی کد نشان داد infrastructure کامل پیاده‌سازی شده است:

| محل | وضعیت |
|---|---|
| `TimelineBar.tsx` خط 600-645 (Compact view) | `draggable`, `onDragStart/Over/Drop/End`, GripVertical handle ✅ |
| `TimelineBar.tsx` خط 685-712 (Track view) | همان handlers روی هر scene block ✅ |
| `TimelineBar.tsx` خط 447-475 | handlers تعریف‌شده ✅ |
| `ProVideoEditor.tsx` خط 1082-1091 | `handleMoveScene` با `pushHistory` و swap ✅ |
| Wiring خط 2207 | `onMoveScene={handleMoveScene}` ✅ |

**چرا کاربر فکر می‌کند کار نمی‌کند؟**
1. در پروژه‌ی فعلی فقط **یک scene** وجود دارد (تصویر "Cinematic Intro") → drag بی‌نتیجه است
2. در `handleSceneDrop` یک **باگ منطقی** وجود دارد: برای drag از index 0 → 3، حلقه `onMoveScene(0, 1)` را سه بار صدا می‌زند، اما `storyboard` در کلوژر همان snapshot قدیمی است → swap اول درست انجام می‌شود ولی swap دوم/سوم نتیجه را خراب می‌کند (جابجایی روی state قدیمی محاسبه می‌شود، نه روی state به‌روزشده)
3. در هر swap یک toast «Scene moved» نمایش داده می‌شود → برای drag چند موقعیتی چند toast pop می‌شود
4. هیچ visual hint قبل از drag نشان نمی‌دهد که این کلیپ draggable است

## برنامه‌ی اصلاحی — جایگزینی منطق swap با reorder تک‌مرحله‌ای

### فایل ۱: `src/components/ad-director/ProVideoEditor.tsx`

**افزودن یک handler جدید `handleReorderScene(fromIdx, toIdx)`** که در یک عملیات اتمی scene را از موقعیت `fromIdx` بر می‌دارد و در `toIdx` می‌گذارد:

```ts
const handleReorderScene = useCallback((fromIdx: number, toIdx: number) => {
  if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
  if (fromIdx >= storyboard.length || toIdx >= storyboard.length) return;
  pushHistory(storyboard);
  const updated = [...storyboard];
  const [moved] = updated.splice(fromIdx, 1);
  updated.splice(toIdx, 0, moved);
  onUpdateStoryboard?.(updated);
  setSelectedSceneIndex(toIdx);
  toast({ title: `Scene moved to position ${toIdx + 1}` });
}, [storyboard, pushHistory, onUpdateStoryboard, toast]);
```

**حفظ `handleMoveScene` قبلی** برای دکمه‌های Move Left/Right در context menu (که فقط ±1 جابجا می‌کنند و باگ ندارند).

**Pass به TimelineBar:** `onReorderScene={handleReorderScene}` در کنار `onMoveScene` موجود.

### فایل ۲: `src/components/ad-director/editor/TimelineBar.tsx`

**A. افزودن prop جدید:**
```ts
onReorderScene?: (fromIdx: number, toIdx: number) => void;
```

**B. ساده‌سازی `handleSceneDrop`** — به‌جای حلقه‌ی swap، یک فراخوانی reorder:
```ts
const handleSceneDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
  e.preventDefault();
  const fromIdx = sceneDragIdx;
  setSceneDragIdx(null);
  setSceneDropIdx(null);
  if (fromIdx === null || fromIdx === dropIdx) return;
  if (onReorderScene) {
    onReorderScene(fromIdx, dropIdx);  // ← یک عملیات اتمی
  } else if (onMoveScene) {
    // fallback قدیمی
    const dir = dropIdx > fromIdx ? 1 : -1;
    let current = fromIdx;
    while (current !== dropIdx) { onMoveScene(current, dir); current += dir; }
  }
}, [sceneDragIdx, onReorderScene, onMoveScene]);
```

**C. بهبود feedback بصری روی drop target** (در هر دو view):
- خط vertical نمایش دهنده‌ی محل drop در سمت چپ یا راست بسته به جهت drag
- نشانگر فعلی (`ring-2 ring-red-500`) نگه داشته می‌شود

**D. برای حل سردرگمی کاربر زمانی که فقط یک scene دارد** — افزودن یک hint کوچک در toolbar تایم‌لاین وقتی `storyboard.length > 1`:
```tsx
{storyboard.length > 1 && (
  <span className="text-[9px] text-zinc-500 italic">
    Drag clips to reorder
  </span>
)}
```

### آنچه دست‌نخورده می‌ماند
- `handleMoveScene` و دکمه‌های Move Left/Right در context menu
- منطق `pushHistory` و undo/redo
- منطق timeline rendering، playhead، export، stitching
- DB / RLS / edge functions
- Compact vs Expanded view layout

## نتیجه پس از اصلاح
1. ✅ Drag یک scene از موقعیت 0 به موقعیت 3 → در یک عملیات اتمی و درست انجام می‌شود
2. ✅ فقط یک toast نمایش داده می‌شود
3. ✅ Undo (Ctrl+Z) به state قبل از drag بازمی‌گردد (یک snapshot)
4. ✅ کاربر hint بصری «Drag clips to reorder» می‌بیند وقتی >1 scene دارد
5. ✅ خروجی نهایی export ترتیب جدید را دنبال می‌کند (چون از `storyboard` reorder شده می‌خواند)
6. ✅ سازگار با هر دو view (Compact cards + Expanded track)

