

# ارتقای Auto Music به Lyria 3 با پرامپت‌های حرفه‌ای

## هدف
دکمه‌ی **Auto Music** در Pro Editor (timeline) باید به‌جای پرامپت ساده، از فرمول حرفه‌ای Lyria 3 (Genre + Mood + Instruments + Vocals) استفاده کند و سه preset آماده + یک مسیر "Custom" در اختیار کاربر بگذارد.

## ریشه‌ی فعلی
الان دکمه‌ی Auto Music در `AudioPromptDialog` فقط یک input متنی ساده می‌دهد و با duration ثابت، prompt را به edge function `lyria-music` (یا `elevenlabs-music`) می‌فرستد. هیچ راهنمایی، preset، یا فیلد ساختاریافته‌ای وجود ندارد.

## رفع (سه فایل، حداقلی)

### A) `AudioPromptDialog.tsx` — افزودن Tab "Lyria Pro" با preset و custom builder

داخل تب **Generate**، یک sub-toggle اضافه می‌شود:
- **Quick Prompt** (همان رفتار فعلی، دست‌نخورده)
- **Lyria Pro** (جدید) → شامل:
  - **Preset chips** (سه دکمه افقی): "Upbeat Pop-Electronic" / "Lo-Fi Chill" / "Cinematic Epic"
  - با کلیک روی هر preset، فیلدهای زیر خودکار پر می‌شود ولی قابل ویرایش‌اند:
    - **Genre** (Input کوتاه)
    - **Mood** (Input کوتاه)
    - **Instruments** (Input)
    - **Vocals** (ToggleGroup: Instrumental / Vocals EN / Vocals FA)
    - **Lyric Theme** (Textarea کوچک، فقط اگر Vocals انتخاب شد)
  - **Duration** همان (15/30/60s)
  - دکمه‌ی **Generate Music** پرامپت نهایی را با فرمول زیر می‌سازد و به handler موجود می‌دهد:
    ```
    Generate a {duration}s {genre} track at {bpmHint}. Mood: {mood}. 
    Instruments: {instruments}. {vocalsClause}
    ```
  - اگر Vocals=Instrumental → `vocalsClause = "Fully instrumental, no vocals."`
  - اگر Vocals=EN/FA → `vocalsClause = "Include realistic vocals in {language} singing about: {lyricTheme}."`

ساختار `AudioPromptResult` و callback `onGenerate` بدون تغییر — فقط محتوای `prompt` غنی‌تر می‌شود. backward compatible کامل.

### B) فایل جدید `src/data/lyriaPresets.ts` — تعریف ۳ preset

شامل آرایه‌ای از:
```ts
{ id, label, icon, genre, mood, instruments, vocals, lyricTheme, bpmHint }
```
سه ورودی: Upbeat Pop-Electronic / Lo-Fi Chill / Cinematic Epic — دقیقاً برگرفته از سه نمونه‌ی پیام شما با مقادیر default.

این فایل صرفاً data است؛ هیچ side-effect یا dependency جدید.

### C) (اختیاری، محافظتی) `supabase/functions/lyria-music/index.ts`

افزایش حد بالای duration از 60s به 60s باقی بماند (Lyria 3 معمولاً 30-60s sweet spot). هیچ تغییر منطقی لازم نیست — فقط در صورتی که نیاز شد یک log اضافه کنیم که نشان دهد prompt structured آمده. این تغییر ممکن است انجام نشود اگر edge function هم‌اکنون پرامپت طولانی را به‌خوبی پاس می‌دهد (که می‌دهد).

## محدوده‌ی تغییر

تغییر می‌کند:
- `src/components/ad-director/editor/AudioPromptDialog.tsx` — افزودن sub-tab "Lyria Pro" + state structured fields
- `src/data/lyriaPresets.ts` — جدید (~40 خط)

تغییر **نمی‌کند:**
- edge function `lyria-music` / `elevenlabs-music` (پرامپت رشته است؛ غنی‌تر شدن آن مشکلی ندارد)
- منطق timeline / music track / `useAudioGeneration` hook
- Quick Prompt mode (کاملاً دست‌نخورده برای backward compat)
- AdDirector main flow

## مراحل اجرا

1. ساخت `src/data/lyriaPresets.ts` با سه preset
2. آپدیت `AudioPromptDialog.tsx`:
   - افزودن sub-toggle داخل تب Generate
   - فرم structured (Genre/Mood/Instruments/Vocals/LyricTheme)
   - تابع `buildLyriaPrompt()` که ۴ فاکتور را به یک پرامپت طبیعی تبدیل کند
3. تست end-to-end: کلیک Auto Music → انتخاب "Cinematic Epic" → Generate → موسیقی ۳۰ ثانیه‌ای ارکسترال در timeline

## اعتبارسنجی

- ✅ تب Quick Prompt دقیقاً مثل قبل کار می‌کند
- ✅ تب Lyria Pro با یک کلیک روی preset همه فیلدها را پر می‌کند
- ✅ کاربر می‌تواند هر فیلد را ویرایش کند قبل از Generate
- ✅ خروجی edge function همان MP3 است که در track Music قرار می‌گیرد
- ✅ هیچ تغییری در DB، RLS، یا سایر صفحات

