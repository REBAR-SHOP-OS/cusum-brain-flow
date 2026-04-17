
## درخواست کاربر
در timeline editor، زیر نوار ویدئو، دو نوار جداگانه نمایش داده شود:
1. **نوار صدا (Audio)** — اگر کلیپ صدا دارد، waveform یا نوار رنگی نشان داده شود
2. **نوار متن (Text)** — اگر کلیپ متن/subtitle دارد، به شکل نوار نشان داده شود

## بررسی فعلی

نیاز است این فایل‌ها بررسی شوند:
- `ProVideoEditor.tsx` (~2200 خط) — ساختار timeline و clips
- `videoOverlay.ts` — overlays شامل text, subtitle, با startTime/endTime
- ساختار `clips` در `backgroundAdDirectorService` — voiceover URL per clip

از فایل‌های موجود می‌دانم:
- `VideoOverlay` فیلد `kind: "text"` دارد + `startTime/endTime` + `sceneId`
- هر clip ممکن است voiceover (audio URL) داشته باشد
- Timeline فعلاً فقط thumbnail نوار ویدئو را نشان می‌دهد

## برنامه پیشنهادی

### 1. ساختار Timeline سه‌ردیفه
زیر نوار ویدئوی موجود، دو track افقی اضافه شود:

```
┌─────────────────────────────────┐
│  🎬 Video Track (موجود)         │  ← thumbnails کلیپ‌ها
├─────────────────────────────────┤
│  🔊 Audio Track (جدید)          │  ← waveform/bars برای کلیپ‌هایی که voiceover دارند
├─────────────────────────────────┤
│  📝 Text Track (جدید)           │  ← bar های رنگی برای text overlays
└─────────────────────────────────┘
```

هر track با عرض کامل timeline، segment های هم‌تراز با کلیپ مربوطه.

### 2. Audio Track
- برای هر clip که `voiceoverUrl` یا `audioUrl` دارد:
  - یک bar با gradient (مثلاً `from-cyan-500 to-blue-500`)
  - نمایش بصری ساده‌ی موج به صورت bars متغیر (CSS-only، بدون decoding واقعی audio برای سرعت)
  - ارتفاع ~24px
- اگر کلیپی audio ندارد → bar خاکستری کم‌رنگ "No audio"
- کلیک روی bar → باز کردن VoiceoverDialog برای آن scene

### 3. Text Track
- برای هر `VideoOverlay` با `kind === "text"` (شامل subtitles):
  - bar با موقعیت `startTime → endTime` نسبت به scene
  - رنگ متمایز (مثلاً `from-amber-500 to-orange-500`)
  - متن truncate شده داخل bar
  - ارتفاع ~24px
- کلیک روی bar → باز کردن `EditOverlayDialog` برای edit متن
- اگر scene متن ندارد → bar خاکستری "No text"

### 4. هم‌ترازی (Alignment)
هر سه track از یک محاسبه‌ی width استفاده می‌کنند:
```ts
width = (clipDuration / totalDuration) * 100 + "%"
```
تا scrub bar و playhead به‌صورت یکپارچه روی هر سه track حرکت کند.

### 5. State و فایل‌های لازم
- **فایل جدید**: `src/components/ad-director/editor/TimelineTracks.tsx`
  - props: `clips`, `overlays`, `currentTime`, `totalDuration`, `onAudioClick`, `onTextClick`
  - render: سه `<div>` افقی با segment ها
- **تغییر در `ProVideoEditor.tsx`**: زیر بلوک timeline موجود، `<TimelineTracks ... />` اضافه شود
- منطق فعلی drag/drop/scrub دست‌نخورده باقی می‌ماند

### 6. Visual Design
- پس‌زمینه track ها: `bg-slate-900/50 border-t border-white/5`
- Label سمت چپ هر track (40px width): آیکن `Volume2` و `Type`
- Hover state روی هر segment: `ring-1 ring-white/30`
- Active (currently playing) state: glow ملایم

## آنچه دست‌نخورده می‌ماند
- منطق playback (`videoRef`, `currentTime`)
- Drag & drop reorder کلیپ‌ها
- Sidebar tabs (Media/Text/Transitions/...)
- Stitch pipeline / export
- DB / RLS / edge functions
- Voiceover/Subtitle dialog ها (فقط trigger می‌شوند)

## نتیجه
1. ✅ زیر نوار ویدئو، Audio track با visualization waveform نمایش داده می‌شود
2. ✅ زیر آن، Text track با bars رنگی برای هر overlay متنی
3. ✅ هم‌ترازی کامل با clips بالایی و playhead مشترک
4. ✅ کلیک روی Audio bar → ویرایش voiceover
5. ✅ کلیک روی Text bar → ویرایش متن
6. ✅ کلیپ‌های بدون صدا/متن، placeholder خاکستری نشان می‌دهند
7. ✅ زبان UI: کاملاً انگلیسی (طبق memory rule)
