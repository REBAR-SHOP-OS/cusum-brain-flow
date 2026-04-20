

## درخواست کاربر
وقتی روی **Auto Music** کلیک می‌شود باید:
1. ✅ یک موسیقی **بی‌کلام** (instrumental, no vocals) ساخته شود
2. ✅ یک **نوار آبی** در lane Music در timeline بلافاصله ظاهر شود
3. ✅ موسیقی واقعاً در preview **پخش شود** (هم‌اکنون فقط در export پخش می‌شود)

## بررسی کد — وضعیت فعلی

با مطالعه‌ی `ProVideoEditor.tsx` و `editor/TimelineBar.tsx`:

### ✅ آنچه درست کار می‌کند
- `generateBackgroundMusic()` (خط ۱۸۷۲-۱۹۲۸) prompt صریح "NO vocals, NO lyrics, NO singing" ارسال می‌کند به edge function `lyria-music` (که از ElevenLabs Music API استفاده می‌کند).
- پس از موفقیت، track با `kind: "music"` به `audioTracks` اضافه می‌شود.
- `TimelineBar.tsx` خط ۱۱۲۸-۱۱۸۴ یک Music lane اختصاصی دارد که هر track با `kind === "music"` را به‌صورت bar آبی render می‌کند.

### ❌ ریشه‌های ناپایداری (سه باگ مستقل)

**باگ ۱: نبود `duration` و `globalStartTime` کامل** — track ساخته‌شده در خط ۱۹۱۳ فقط `globalStartTime: 0` دارد، **بدون `duration`**. در TimelineBar خط ۱۱۴۸: `trackDur = track.duration ?? ... ?? totalDuration`. اگر `endTime` و `startTime` هم نباشند، `widthPct` تا کل عرض گسترش می‌یابد — ولی این OK است. **مشکل واقعی**: اگر `totalDuration === 0` (segments خالی یا قبل از load)، `widthPct = 0` و bar ناپدید می‌شود.

**باگ ۲: hardcoded duration cap = 60 ثانیه** — خط ۱۹۰۱: `duration: Math.min(totalDuration, 60)`. اگر video طولانی‌تر از 60s باشد، music کمتر از کل ویدئو خواهد بود (OK)، ولی اگر `totalDuration` خیلی کم باشد (مثلاً <5s)، endpoint ElevenLabs ممکن است fail کند چون حداقل آن 5s است.

**باگ ۳ (مهم‌ترین): music در preview پخش نمی‌شود** — هیچ `<audio>` element برای music ساخته نمی‌شود. `setMusicUrl` فقط state می‌نویسد ولی consumer ندارد. کاربر می‌بیند نوار ساخته شده ولی صدای موسیقی نمی‌شنود تا زمان export.

**باگ ۴: عدم race-protection** — اگر کاربر دو بار سریع کلیک کند، `setAudioTracks(prev => prev.filter(t => t.kind !== "music"))` در ابتدا اجرا می‌شود ولی track قدیم URL ساخته از قبل revoke نمی‌شود → memory leak.

## برنامه (Surgical, Deterministic)

### بخش ۱: تضمین ساخت قابل دیدن نوار
در `generateBackgroundMusic` (خط ۱۸۷۲-۱۹۲۸):

1. **محاسبه‌ی duration درست**:
   ```ts
   const totalDuration = segments.reduce((sum, seg) => sum + (seg.endTime - seg.startTime), 0);
   const safeDuration = Math.max(5, Math.min(totalDuration || 30, 60)); // floor=5, cap=60
   ```

2. **Revoke URL قدیمی** قبل از حذف track music قبلی برای جلوگیری از memory leak.

3. **افزودن track با `duration` صریح** تا bar بلافاصله با عرض درست در timeline ظاهر شود:
   ```ts
   {
     sceneId: "",
     label: "🎵 Auto Music",
     audioUrl: musicUrl,
     kind: "music" as const,
     globalStartTime: 0,
     duration: safeDuration,
     volume: 0.3,
   }
   ```

4. **تقویت prompt instrumental** — اضافه‌کردن `"100% instrumental, orchestral only"` تا تضمین شود کلام در آن نباشد (الان prompt قوی است ولی محکم‌ترش می‌کنیم).

5. **Toast واضح** با موفقیت/شکست.

### بخش ۲: پخش music در preview
افزودن `<audio>` element مخفی برای music که با video sync باشد:

1. **`musicAudioRef`** جدید با `useRef<HTMLAudioElement | null>(null)`.
2. **`useEffect`** که وقتی `musicUrl` یا track‌های music تغییر می‌کند، یک Audio element می‌سازد، `loop = false`, `volume = 0.3`.
3. **Sync با playback ویدئو**:
   - وقتی `isPlaying === true` → `musicAudio.play()`
   - وقتی `isPlaying === false` → `musicAudio.pause()`
   - وقتی scene تعویض می‌شود (advanceToNextScene)، music ادامه می‌یابد (نه restart) چون موسیقی برای کل ویدئو پیوسته است.
   - drift correction: هر چند ثانیه `musicAudio.currentTime` را با cumulative video time هم‌تراز کن.
4. **Mute global** هم music را mute می‌کند.

### بخش ۳: توقف cleanup روی unmount
- `useEffect cleanup` که `musicAudio.pause()` و `URL.revokeObjectURL(musicUrl)` را روی unmount صدا می‌زند.

## فایل‌های تغییرکننده
- `src/components/ad-director/ProVideoEditor.tsx`:
  - تقویت `generateBackgroundMusic` (خط ۱۸۷۲-۱۹۲۸): محاسبه‌ی duration امن، revoke URL قدیم، افزودن `duration` و `volume` به track، prompt محکم‌تر
  - افزودن `musicAudioRef` و useEffect برای sync پخش music با video
  - Cleanup در unmount

## آنچه دست‌نخورده می‌ماند
- منطق scene generation (Veo / Wan / Sora)
- Voiceover playback / extraction
- Timeline thumbnails / transitions
- Subtitle rendering, logo, end card
- Edge function `lyria-music` (همان است)
- DB / RLS
- زبان UI: انگلیسی

## نتیجه‌ی مورد انتظار
1. ✅ کلیک روی **Auto Music** → موسیقی بی‌کلام instrumental ساخته می‌شود
2. ✅ نوار آبی در lane **Music** در timeline بلافاصله نمایش داده می‌شود (با عرض صحیح)
3. ✅ موسیقی **واقعاً در preview پخش می‌شود** هم‌زمان با video و voiceover
4. ✅ Mute سراسری music را هم mute می‌کند
5. ✅ بدون memory leak از URL‌های قدیم
6. ✅ کار می‌کند برای ویدئوهای ۵s تا ۶۰s

