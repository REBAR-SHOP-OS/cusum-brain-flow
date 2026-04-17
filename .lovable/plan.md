

## درخواست کاربر
در بخش **Generated Scenes** (قبل از ورود به editor) دو قابلیت اضافه شود:
1. **Drag & drop reorder** کارت‌های ویدئو
2. **شماره‌گذاری واضح** روی هر کارت (1، 2، 3 ...)
3. ترتیب جدید باید وقتی کاربر «Edit Video» می‌زند، در timeline editor دقیقاً همان باشد

## بررسی کد فعلی

**فایل:** `src/components/ad-director/AdDirectorContent.tsx` خط 446-540

- کارت‌ها از `clips` (آرایه) و `storyboard[i]` (موازی index) ساخته می‌شوند
- لیبل فعلی: `{i + 1}. {segType}` در overlay پایین کارت — شماره هست ولی **خیلی کوچک و کم‌رنگ** است
- هیچ drag handler نیست
- State از طریق `service.patchState({ clips, storyboard })` در singleton `backgroundAdDirectorService` به‌روز می‌شود
- Editor (`ProVideoEditor`) همان `clips` و `storyboard` را از pipeline state می‌خواند → reorder خودکار propagate می‌شود ✅

## برنامه‌ی اصلاحی

### تغییر فقط در یک فایل: `src/components/ad-director/AdDirectorContent.tsx`

#### A. افزودن state برای drag tracking
```ts
const [dragIdx, setDragIdx] = useState<number | null>(null);
const [dropIdx, setDropIdx] = useState<number | null>(null);
```

#### B. افزودن handler reorder اتمی
```ts
const handleReorderClips = useCallback((from: number, to: number) => {
  if (from === to || from < 0 || to < 0) return;
  const newClips = [...clips];
  const newStoryboard = [...storyboard];
  const [movedClip] = newClips.splice(from, 1);
  const [movedScene] = newStoryboard.splice(from, 1);
  newClips.splice(to, 0, movedClip);
  newStoryboard.splice(to, 0, movedScene);
  service.patchState({ clips: newClips, storyboard: newStoryboard });
  toast({ title: `Scene moved to position ${to + 1}` });
}, [clips, storyboard, service, toast]);
```

> هم `clips` و هم `storyboard` با هم reorder می‌شوند چون در editor با index موازی استفاده می‌شوند.

#### C. افزودن handlers روی wrapper کارت
- `draggable={clip.status === "completed"}` (فقط کارت‌های آماده قابل drag)
- `onDragStart` → `setDragIdx(i)`
- `onDragOver` → `e.preventDefault(); setDropIdx(i)`
- `onDragLeave` → `setDropIdx(null)`
- `onDrop` → `handleReorderClips(dragIdx, i)` و reset
- `onDragEnd` → reset state

#### D. نشانگر بصری drop target
- وقتی `dropIdx === i && dragIdx !== i` → `ring-2 ring-primary/70 scale-105` روی کارت
- `cursor-grab` در حالت عادی، `cursor-grabbing` حین drag
- روی hover یک `GripVertical` icon (نیمه‌شفاف) بالا-چپ کارت ظاهر شود تا کاربر بفهمد draggable است

#### E. شماره‌گذاری بزرگ و واضح
به‌جای فقط lable کوچک پایینی، یک **badge شماره‌ی برجسته** بالا-چپ هر کارت اضافه می‌شود:
```tsx
<div className="absolute top-1.5 left-1.5 z-10 w-7 h-7 rounded-full 
                bg-primary text-primary-foreground text-xs font-bold 
                flex items-center justify-center shadow-lg ring-2 ring-background">
  {i + 1}
</div>
```
- عدد همیشه دیده می‌شود (نه فقط hover)
- پس از reorder، شماره‌ها خودکار به‌روز می‌شوند چون از `i` می‌آیند
- لیبل پایین (`{i+1}. {segType}`) حفظ می‌شود برای context type

#### F. Hint کوچک کنار عنوان «Generated Scenes» وقتی >1 کلیپ
```tsx
{clips.length > 1 && (
  <span className="text-[10px] text-muted-foreground/70 italic ml-2">
    · Drag to reorder
  </span>
)}
```

## آنچه دست‌نخورده می‌ماند
- منطق generation، regenerate، prompt input، preview selection
- `ProVideoEditor` و timeline (خودکار از clips/storyboard reorder شده می‌خواند) ✅
- Save Draft / Edit Video buttons
- DB / RLS / edge functions / pipeline service interface
- شماره‌گذاری در editor (که از قبل با drag-and-drop کار می‌کند)

## نتیجه پس از اصلاح
1. ✅ هر کارت یک **badge عدد بزرگ آبی** بالا-چپ دارد (1، 2، 3 ...)
2. ✅ کارت‌های completed قابل **drag & drop** هستند
3. ✅ نشانگر بصری حین drag (ring + scale) محل drop را نشان می‌دهد
4. ✅ Hint «Drag to reorder» کنار عنوان نمایش داده می‌شود وقتی >1 کلیپ
5. ✅ ترتیب جدید فوراً در `service` ذخیره می‌شود → ورود به Edit Video همان ترتیب را در timeline نشان می‌دهد
6. ✅ `clips` و `storyboard` با هم reorder می‌شوند → سازگاری index کامل حفظ می‌شود
7. ✅ Toast تأییدی پس از هر reorder

