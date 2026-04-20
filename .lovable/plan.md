

# قانون Hard: ویدیوها همیشه باید بدون صدا تولید شوند

## ریشه مشکل (تأیید‌شده)

دو منبع مستقل صدا روی ویدیو سوار می‌شود:

### ۱. صدای ذاتی Wan 2.6 (مشکل اصلی تصویر اول)
مدل‌های `wan2.6-t2v` و `wan2.6-i2v` **به‌طور پیش‌فرض صدای محیطی auto-generate می‌کنند** (ambient sound effects, footsteps, room tone, musical stings). در `generate-video/index.ts` فعلی، negative prompt فقط dialogue/voiceover/dubbing را دفع می‌کند ولی **هیچ‌چیز جلوی صدای ambient/music ذاتی Wan را نمی‌گیرد**. این چیزی است که در ویدیوی ۱۵ ثانیه‌ای تصویر اول می‌شنوید.

Veo و Sora هم همین رفتار را دارند (Sora 2 صدا هم تولید می‌کند).

### ۲. موزیک stitcher (پنهان ولی فعال)
در `backgroundAdDirectorService.ts:1135` و `AdDirectorContent.tsx:206`، اگر `state.musicTrackUrl` set شده باشد، stitcher آن را روی export نهایی می‌چسباند. حتی اگر کاربر music انتخاب نکند، در صورتی که از قبل از سشن قبلی state داشته باشد، صدا اضافه می‌شود.

## رفع — قانون "Silent by Default" در دو لایه

### لایه A: حذف صدای ذاتی Wan/Sora در منبع تولید

**فایل: `supabase/functions/generate-video/index.ts`**

1. اضافه کردن یک constant سراسری:
   ```ts
   const SILENT_VIDEO_MODE = true; // HARD RULE: never embed audio
   ```

2. در `wanGenerate` و `wanI2vGenerate`:
   - `WAN_BASE_NEGATIVE` را گسترش بده با: `ambient sound, sound effects, music, background music, audio, sound, breathing, footsteps, room tone, environmental noise`
   - بلوک `if (audioUrl) params.audio_url = audioUrl;` را حذف کن (یا پشت `!SILENT_VIDEO_MODE` گذاشت)
   - پارامتر `audioUrl` را از signature حذف کن (یا ignore کن)

3. در `soraGenerate`:
   - اگر Sora 2 پارامتر `audio: false` یا معادل پشتیبانی می‌کند، اضافه شود (طبق docs OpenAI). در غیر این‌صورت، یک نشانه‌گذار `silent` در state بگذاریم تا frontend در زمان playback صدا را mute کند.

4. در `veoGenerate`: مشابه (Veo 3.1 صدا تولید می‌کند، باید پارامتر `generateAudio: false` به Vertex AI پاس شود).

### لایه B: حذف کامل music track از stitcher در AdDirector

**فایل‌ها: `src/lib/backgroundAdDirectorService.ts` + `src/components/ad-director/AdDirectorContent.tsx`**

1. در `backgroundAdDirectorService.ts:1135` — جایگزین کن:
   ```ts
   musicUrl: undefined,  // HARD RULE: no music in generated videos
   musicVolume: 0,
   ```
2. در `AdDirectorContent.tsx:206` — همان تغییر.
3. State `musicTrackUrl` در سرویس باقی می‌ماند تا UI break نشود، ولی هرگز به stitcher پاس داده نمی‌شود.

### لایه C: Mute اجباری روی playback (safety net)

**فایل: `src/components/ad-director/result/...` و `VideoStudioContent.tsx`**

روی `<video>` المان‌های پیش‌نمایش نتیجه، attribute `muted` را اجباری کن (نه فقط `autoplay`). اگر مدل قبلی صدا داشت یا backfill قدیمی صدا دارد، باز هم سکوت پخش شود.

## محدوده تغییر

**تغییر می‌کند:**
- `supabase/functions/generate-video/index.ts` — negative prompt گسترده + حذف audio_url + audio:false برای Sora/Veo
- `src/lib/backgroundAdDirectorService.ts` — `musicUrl: undefined` در stitchClips call
- `src/components/ad-director/AdDirectorContent.tsx` — `musicUrl: undefined` در stitchClips call
- `src/components/ad-director/result/AdResultPreview.tsx` (یا فایل preview معادل) — `muted` روی `<video>`
- `src/components/social/VideoStudioContent.tsx` — `muted` روی `<video>` پیش‌نمایش

**تغییر نمی‌کند:**
- ProVideoEditor (Pro Editor) — کاربر در آن آگاهانه music track می‌چسباند، آن جریان دست‌نخورده باقی می‌ماند چون **انتخاب صریح کاربر** است نه auto
- MusicTab / Lyria preset / dialog — کاربر اگر بخواهد در Pro Editor music بسازد و دستی به timeline اضافه کند، آزاد است
- DB / RLS / edge function های دیگر

## مرز "Silent" در مقابل "Pro Editor"

- **AI Video Director (AdDirector + VideoStudio)**: **همیشه silent**. صدا هرگز embed یا attach نمی‌شود.
- **Pro Editor**: کاربر صراحتاً music/voiceover به timeline اضافه می‌کند → این explicit user action است و مجاز است.

## Memory Update

یک memory جدید در `mem://rules/silent-video-generation` اضافه می‌شود:
> All AI-generated videos in AI Video Director (AdDirector + VideoStudio) MUST be silent. Wan/Veo/Sora must receive negative prompts disabling ambient/music, and stitcher must not attach musicUrl. Pro Editor manual music attachment is the only allowed exception.

## اعتبارسنجی

- ✅ ویدیوی ۱۵ ثانیه‌ای جدید از Wan T2V → کاملاً silent (نه ambient، نه music، نه footsteps)
- ✅ Export نهایی AdDirector → silent، حتی اگر `musicTrackUrl` در state باشد
- ✅ پیش‌نمایش video element → muted attribute (safety net)
- ✅ Pro Editor manual music در timeline → کار می‌کند (دست‌نخورده)
- ✅ هیچ تغییری در DB، RLS، یا auth

