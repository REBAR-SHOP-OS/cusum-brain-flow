

## درخواست کاربر
دو تغییر:
1. بعد از تولید ویدئو، خودکار وارد editor شود (بدون نیاز به Approve → Edit Video)
2. هر چیزی که در ویدئو وجود دارد (text/audio/music) به‌شکل نوار در editor نمایش داده شود، و **حذف نوار = حذف واقعی از ویدئوی export شده**

## یافته‌ی فنی

### بخش ۱ — جریان فعلی
در `AdDirectorContent.tsx` خط 655-666: بعد از `flowState === "result"` کاربر باید:
1. کلیک "Approve Composition"
2. سپس کلیک "Edit Video" → `flowState: "editing"`

### بخش ۲ — مشکل اصلی export pipeline
در `src/lib/videoStitch.ts`:
- **Text overlays editor (`overlays[]`)** هرگز روی ویدئوی export شده draw نمی‌شوند — فقط `subtitles.segments` از options استفاده می‌شود (خط 504, 684-688). یعنی نوار text در editor الان **فقط visual** است.
- **صدای embedded source clip** اصلاً در export وجود ندارد — `v.muted = true` (خط 282) و canvas `captureStream` صدا نمی‌گیرد. فقط `audioUrl` (voiceover) و `musicUrl` (music) mix می‌شوند.
- **حذف نوار music در editor** فقط state داخلی `audioTracks` را تغییر می‌دهد، اما `handleExport` در `AdDirectorContent.tsx` خط 177 از `service.getState().musicTrackUrl` می‌خواند — نه از editor state. پس حذف نوار music روی export اثر ندارد.
- **حذف نوار voiceover** همان مشکل — `voiceoverUrl` از service خوانده می‌شود (خط 134-153 export)، نه از editor.

## برنامه (Surgical, Additive)

### ۱. ورود خودکار به Editor بعد از تولید
در `backgroundAdDirectorService.ts` (یا هرجا flowState بعد از کامل شدن همه scene ها به `"result"` ست می‌شود)، آن را به `"editing"` تغییر دهیم. بدنبال یک‌بار `setFlowState("result")` بعد از موفقیت کامل می‌گردیم و آن را به `"editing"` تبدیل می‌کنیم. حالت "result" برای resume از history (`onSelect` خط 417) و reload draft (خط 241) دست‌نخورده می‌ماند، چون آنجا هنوز clips از history هستند و کاربر می‌خواهد قبل از edit ببیند.
- **اختیاری امن‌تر**: یک flag `autoOpenEditor=true` فقط هنگام پایان یک generation تازه ست شود.

### ۲. حذف نیاز به Approve (اختیاری اما مرتبط)
چون حالا مستقیم وارد editor می‌شویم، دکمه‌های "Approve Composition" / "Edit Video" در view "result" دست‌نخورده می‌مانند برای حالت‌های resume، اما در flow اصلی به آن نمی‌رسیم.

### ۳. اتصال واقعی Editor State به Export (تغییر کلیدی)
الان `handleExport` در `AdDirectorContent.tsx` فقط از `service.state` می‌خواند. اضافه می‌کنیم که editor بتواند state کامل overlay/audio خود را به export پاس دهد:

**۳-الف.** پراپ جدید روی `ProVideoEditor` → `onExportRequest(payload)` که هنگام کلیک Download/Schedule صدا زده می‌شود با:
```ts
{
  overlays: VideoOverlay[],          // text overlays از editor
  audioTracks: AudioTrackItem[],     // voiceover + music های editor
  mutedScenes: string[],             // برای حذف صدای embedded scene
}
```
یا ساده‌تر و کم‌تهاجمی‌تر: قبل از فراخوانی `onExport()`، `ProVideoEditor` این state ها را از طریق callback های موجود (مثل `onMusicSelect`) به service sync می‌کند:
- `onUpdateOverlays(overlays)` → پراپ جدید
- `onUpdateAudioTracks(tracks)` → پراپ جدید
سپس `handleExport` اینها را به `stitchClips` پاس می‌دهد.

**۳-ب.** در `videoStitch.ts`:
- `StitchOverlayOptions` گسترده شود تا `textOverlays?: { sceneId; text; position; size; startTime?; endTime?; style? }[]` بپذیرد
- در render loop (خط ~684)، علاوه بر `subtitleSegments`، روی `textOverlays` فعال در زمان جاری iterate شده و draw شوند (با position درصدی نسبت به W/H)
- برای **music های متعدد** (خط 444-461): به‌جای یک `musicElement`، آرایه‌ی `audioTracks.filter(kind==='music' && !extractedFromVideo)` mix شود. هر کدام gain خودش
- برای **voiceover های editor** (به جای فقط `audioUrl`): mix همه‌ی `audioTracks.filter(kind==='voiceover')`
- برای **embedded audio هر scene**: 
  - اگر scene در `mutedScenes` نیست → یک `<audio>` element با `src = clip.videoUrl` بسازیم، sync با playback همان clip در timeline (currentTime ست شود به clipStart)، connect به audioCtx
  - اگر scene mute است → skip
  - این جوری حذف نوار آبی music (که extractedFromVideo است) عملاً همان scene را mute می‌کند

**۳-ج.** ارتباط بصری ↔ منطقی:
- نوار آبی **Music (extractedFromVideo)** → هنگام delete، scene را به `mutedScenes` اضافه کن (به‌جای فقط حذف از array)
- نوار **Voiceover/Music دستی** → هنگام delete، track از `audioTracks` حذف، export آن را شامل نمی‌کند
- نوار **Text** → هنگام delete، overlay از `overlays` حذف، export متن را draw نمی‌کند

### ۴. Sync editor state → service قبل از export
ساده‌ترین مسیر: در `ProVideoEditor` یک `useEffect` اضافه شود که هرگاه `overlays`, `audioTracks`, `mutedScenes` تغییر کرد، callback های جدید `onUpdateOverlays`/`onUpdateAudioTracks`/`onUpdateMutedScenes` را صدا بزند تا service این state ها را نگه دارد. سپس `handleExport` آنها را به `stitchClips` پاس دهد.

## فایل‌های تغییرکننده
- `src/lib/backgroundAdDirectorService.ts` — flowState پایان generation: "result" → "editing"
- `src/lib/videoStitch.ts` — پشتیبانی از `textOverlays[]`، چند music، چند voiceover، embedded scene audio با `mutedScenes`
- `src/components/ad-director/ProVideoEditor.tsx` — sync editor state به service از طریق پراپ‌های جدید؛ تغییر delete نوار آبی به add-to-mutedScenes
- `src/components/ad-director/AdDirectorContent.tsx` — پراپ‌های جدید به ProVideoEditor، پاس editor-state به `stitchClips` در `handleExport`
- `src/lib/backgroundAdDirectorService.ts` — افزودن state های `editorOverlays`, `editorAudioTracks`, `editorMutedScenes`

## آنچه دست‌نخورده می‌ماند
- منطق timeline rendering, drag/resize, undo/redo
- منطق تولید scene و wan 2.6
- DB / RLS / edge functions
- زبان UI: انگلیسی

## نتیجه
1. ✅ بعد از تولید ویدئو → مستقیم وارد editor می‌شود (بدون Approve)
2. ✅ نوارهای text / audio (voiceover) / music که در editor دیده می‌شوند، در export نهایی هم وجود دارند
3. ✅ حذف نوار text → متن از ویدئو حذف می‌شود
4. ✅ حذف نوار music (دستی یا آبی-extracted) → موزیک/صدا از ویدئو حذف می‌شود
5. ✅ حذف نوار voiceover → صدای روایت از ویدئو حذف می‌شود
6. ✅ Preview = WYSIWYG export

