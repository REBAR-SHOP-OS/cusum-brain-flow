

## ریشه‌ی مشکل — تأیید‌شده

دو منبع صدا در پایپلاین اصلی ساخته می‌شوند ولی **هیچ‌گاه به Editor pass نمی‌شوند**:

| منبع صدا | کجا ساخته می‌شود | کجا گم می‌شود |
|---|---|---|
| **Voiceover** (TTS کل narration via `elevenlabs-tts`) | `AdDirectorContent.tsx` خط 131-150 — به‌صورت local variable داخل `handleExport` ساخته می‌شود | بعد از stitch این URL **دور ریخته می‌شود** و در state ذخیره نمی‌شود |
| **Background Music** (Auto Music) | در state به‌عنوان `musicTrackUrl` ذخیره است | به ProVideoEditor pass نمی‌شود |

نتیجه: `ProVideoEditor` با `useState<AudioTrackItem[]>([])` خالی شروع می‌شود — کاربر در timeline هیچ نوار صدایی نمی‌بیند، فقط placeholder خالی music ("No music · click + to add"). صدا فقط داخل WebM ترکیبی embedded است و قابل ادیت/حذف/جابجایی نیست.

## انتظار کاربر
وقتی **Edit Video** زده می‌شود:
1. ✅ صدای voiceover (همان TTS که در stitch استفاده شد) باید به‌عنوان یک **track مستقل** در timeline ظاهر شود
2. ✅ صدای music پس‌زمینه (اگر Auto Music زده شده) باید به‌عنوان track دوم در timeline ظاهر شود
3. ✅ ویدیوی preview در editor باید **silent** پخش شود تا با track های صدا تداخل نکند (در غیر این صورت دو بار صدا می‌شنود)

---

## برنامه‌ی اصلاحی (سه فایل، سطحی و additive)

### فایل ۱: `src/lib/backgroundAdDirectorService.ts` (خط 60-111)
اضافه کردن یک field به state:
```ts
voiceoverUrl: string | null;  // TTS narration URL از stitch pipeline
```
و در `initialState()` مقدار اولیه `voiceoverUrl: null`.

### فایل ۲: `src/components/ad-director/AdDirectorContent.tsx` (خط 131-150 + 290-300)
**A.** بعد از ساخت TTS audioUrl در `handleExport`، آن را در state ذخیره کنیم:
```ts
service.patchState({ voiceoverUrl: audioUrl ?? null });
```
**B.** در destructuring (خط 63-67)، `voiceoverUrl` را extract کنیم.
**C.** در render کردن `<ProVideoEditor>` این prop را pass کنیم: `voiceoverUrl={voiceoverUrl}` و `musicTrackUrl={musicTrackUrl}` (که از state موجود است).

### فایل ۳: `src/components/ad-director/ProVideoEditor.tsx` (خط 49-70 + 460-465)
**A.** اضافه کردن دو prop جدید به interface:
```ts
voiceoverUrl?: string | null;
musicTrackUrl?: string | null;
```
**B.** اضافه کردن یک `useEffect` بعد از `setAudioTracks` declaration:
```ts
const tracksSeededRef = useRef(false);
useEffect(() => {
  if (tracksSeededRef.current) return;
  if (!storyboard.length) return;
  const seeded: AudioTrackItem[] = [];
  if (voiceoverUrl) seeded.push({
    sceneId: storyboard[0].id, label: "🎙️ Voiceover",
    audioUrl: voiceoverUrl, kind: "voiceover", volume: 1, globalStartTime: 0,
  });
  if (musicTrackUrl) seeded.push({
    sceneId: "", label: "🎵 Background Music",
    audioUrl: musicTrackUrl, kind: "music", volume: 0.5, globalStartTime: 0,
  });
  if (seeded.length) {
    setAudioTracks(seeded);
    if (musicTrackUrl) setMusicUrl(musicTrackUrl);
    tracksSeededRef.current = true;
  }
}, [voiceoverUrl, musicTrackUrl, storyboard]);
```
**C.** برای جلوگیری از پخش دوبل، روی `<video>` preview در editor `muted={!!voiceoverUrl || !!musicTrackUrl}` اضافه شود (وقتی voiceover/music به‌عنوان track مستقل پخش می‌شود، صدای embedded ویدیو باید silent باشد).

### آنچه دست‌نخورده می‌ماند
- پایپلاین stitch، CHARACTER LOCK، duration snap، negative prompts — هیچ تغییری
- منطق Voiceover/Music tabs در editor (دستی) — کاربر همچنان می‌تواند جایگزین کند
- Export نهایی، DB schema، RLS — هیچ تغییری
- TimelineBar — بدون تغییر، همان منطق نمایش audio tracks موجود است

## نتیجه پس از اصلاح
1. ✅ با کلیک روی **Edit Video**، voiceover به‌عنوان track «🎙️ Voiceover» در timeline ظاهر می‌شود
2. ✅ Music پس‌زمینه به‌عنوان track «🎵 Background Music» در timeline ظاهر می‌شود
3. ✅ ویدیوی preview silent پخش می‌شود → شنیدن دوبل اتفاق نمی‌افتد
4. ✅ کاربر می‌تواند هر track را trim/move/حذف/volume control کند
5. ✅ Re-export نهایی همان رفتار قبلی را دارد (audio tracks جزء overlay پایپلاین export هستند)

