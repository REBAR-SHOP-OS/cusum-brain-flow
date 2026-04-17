

## درخواست کاربر
دکمه‌های Undo / Redo که بالای editor (کنار دکمه Back) هستند باید **هر تغییری** را ذخیره کنند، نه فقط بعضی‌ها — تا کاربر بتواند به مرحله‌ی قبل یا بعد برگردد.

## یافته‌ی فنی
در `ProVideoEditor.tsx`:
1. **History فقط `storyboard` را snapshot می‌کند** (خط 852: `useState<StoryboardScene[][]>`). تغییرات روی audio tracks, text overlays, music، volume، mute، segments timing، position overlay اصلاً ضبط نمی‌شوند.
2. `pushHistory(storyboard)` فقط در 9 جا صدا زده می‌شود (split, trim, duplicate, delete scene, reorder, ...). موارد زیر **هیچ snapshot نمی‌گیرند**:
   - افزودن/حذف voiceover یا music track (خطوط 335, 355, 1652, 1688, 1716...)
   - تغییر volume یا mute (خط 1018)
   - drag/resize/edit text overlay (خط 1793, 1829, 1855)
   - segment timing change در بسیاری مسیرها
3. `undo`/`redo` فقط `onUpdateStoryboard` را صدا می‌زنند — حتی اگر history کامل باشد، state های دیگر (audioTracks, …) restore نمی‌شوند.

## برنامه (Surgical, Additive)

### ۱. Snapshot یکپارچه (Unified Snapshot)
به جای `StoryboardScene[]`، history به یک ساختار کامل تغییر کند:
```ts
interface EditorSnapshot {
  storyboard: StoryboardScene[];
  audioTracks: AudioTrackItem[];
  // textOverlays در داخل storyboard.overlays هست → جداگانه نیاز نیست
  segments?: { id: string; startTime: number; endTime: number }[]; // برای trim
}
```
`history: EditorSnapshot[]` و `pushHistory()` همه‌ی state ها را با هم snapshot می‌کند.

### ۲. تابع unified `pushHistory()`
```ts
const pushHistory = useCallback((override?: Partial<EditorSnapshot>) => {
  const snapshot: EditorSnapshot = {
    storyboard: override?.storyboard ?? storyboard,
    audioTracks: override?.audioTracks ?? audioTracks,
    segments: override?.segments ?? segments,
  };
  // deep clone برای جلوگیری از reference mutation
  const cloned = structuredClone(snapshot);
  setHistory(prev => [...prev.slice(0, historyIndexRef.current + 1), cloned].slice(-50)); // cap 50
  setHistoryIndex(idx => Math.min(idx + 1, 49));
  setHasChanges(true);
}, [storyboard, audioTracks, segments]);
```
- Cap به 50 entry برای جلوگیری از memory bloat
- `structuredClone` تضمین می‌کند redo/undo بعدی state قبلی را خراب نکند

### ۳. `undo()` / `redo()` کامل
هر دو state را restore کنند:
```ts
const apply = (snap: EditorSnapshot) => {
  onUpdateStoryboard?.(snap.storyboard);
  setAudioTracks(snap.audioTracks);
  if (snap.segments && onUpdateSegments) onUpdateSegments(snap.segments);
};
const undo = () => { if (historyIndex > 0) { setHistoryIndex(i=>i-1); apply(history[historyIndex-1]); } };
const redo = () => { if (historyIndex < history.length-1) { setHistoryIndex(i=>i+1); apply(history[historyIndex+1]); } };
```

### ۴. Auto-snapshot برای همه‌ی mutationهای از‌قلم‌افتاده
این نقاط `pushHistory()` اضافه می‌شود **قبل** از تغییر:
- افزودن voiceover/music (خطوط 335, 355, 1688)
- حذف audio track (1022, 1282, 1716)
- تغییر volume / mute scene (1018, و در منطق mutedScenes)
- drag/move/resize text overlay (1793, 1829, 1855) — با debounce 300ms برای جلوگیری از 100 snapshot هنگام درگ
- edit text content / style overlay (1315, 1347)
- segment timing change در همه مسیرها

### ۵. Debounce برای عملیات پیوسته (drag, slider)
helper:
```ts
const pushHistoryDebounced = useDebouncedCallback(pushHistory, 300);
```
هنگام drag overlay یا تنظیم volume slider، فقط آخرین حالت ذخیره شود، نه هر pixel.

### ۶. Seed snapshot کامل در شروع
useEffect مقداردهی اولیه (خط 860) به‌جای فقط `storyboard`، یک `EditorSnapshot` کامل با audioTracks خالی/فعلی push کند.

### ۷. UI feedback
دکمه‌های undo/redo (خط 1960-1964) از قبل `disabled` correctly دارند. اضافه کنیم:
- title پویا: `Undo (N changes)` تا کاربر بفهمد چقدر history دارد
- بعد از undo/redo یک toast کوتاه: `"Undid: scene split"` (اختیاری — می‌توان با ذخیره `label` در snapshot)

### ۸. Reset (`resetAll`) — هم‌خوان شود
خط 906: `resetAll` به اولین snapshot کامل برگردد، نه فقط storyboard اول.

## فایل‌های تغییرکننده
- `src/components/ad-director/ProVideoEditor.tsx` — ساختار `EditorSnapshot`، `pushHistory` یکپارچه، `undo`/`redo` کامل، اضافه کردن `pushHistory()` در ~15 mutation point، debounce برای drag

## آنچه دست‌نخورده می‌ماند
- Timeline rendering, playback، export pipeline
- DB / RLS / edge functions
- Keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z) — همان‌ها فقط روی undo/redo جدید کار می‌کنند
- زبان UI: انگلیسی

## نتیجه
1. ✅ هر تغییر (split, trim, delete, duplicate, reorder, voiceover add/remove, music add/remove, text overlay add/edit/move, volume, mute, segment timing) snapshot می‌شود
2. ✅ Undo / Redo همه‌ی state ها (storyboard + audioTracks + segments) را به‌درستی restore می‌کند
3. ✅ Drag پیوسته با debounce — بدون پر شدن history
4. ✅ Cap 50 entry → بدون memory leak
5. ✅ دکمه‌های UI و keyboard shortcuts همچنان کار می‌کنند
6. ✅ Reset به وضعیت اولیه‌ی کامل

