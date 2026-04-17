
## درخواست کاربر
هر پرامپت — چه پرامپت اولیه‌ی Create Video، چه "Custom prompt..." روی هر کارت scene، چه ویرایش پرامپت — باید طوری ساخته شود که کارت‌های ویدئو **روایی به هم متصل** باشند. هر کارت باید ادامه‌ی منطقی کارت قبلی باشد (نه فقط ظاهر یکسان، بلکه ادامه‌ی action/داستان).

## وضعیت فعلی (یافته‌ها)

✅ **چه چیزی الان کار می‌کند:**
- `ContinuityProfile` (شامل `lastFrameSummary` + `nextSceneBridge`) در `analyze-script` ساخته می‌شود
- `write-cinematic-prompt` صفت‌های ظاهری (environment، lighting، wardrobe، subject) را در هر پرامپت تزریق می‌کند
- `previousScene.prompt.slice(0, 200)` به مدل پاس می‌شود

❌ **چه چیزی شکسته/ضعیف است:**
1. **Regenerate تک‌سینی** (`backgroundAdDirectorService.regenerateScene`): فقط continuity ظاهری (environment/lighting/color/subject) را prefix می‌کند — هیچ ارجاعی به **scene قبلی** یا **scene بعدی** ندارد. وقتی کاربر روی کارت ۲ "Custom prompt" می‌نویسد، کارت ۲ بدون اطلاع از پایان کارت ۱ ساخته می‌شود → گسست روایی.
2. **پرامپت کاربر در "Custom prompt..."** مستقیم به video model می‌رود (`basePrompt = customPrompt.trim()`) — هیچ مرحله‌ی AI bridging قبل از تولید نیست.
3. **`edit-video-prompt`** (وقتی کاربر پرامپت را edit می‌کند) هیچ context از scenes اطراف ندارد.
4. در `write-cinematic-prompt`، فقط 200 کاراکتر اول pervasive هست — `lastFrameSummary` و `nextSceneBridge` از `continuityProfile` استفاده نمی‌شود.

## برنامه‌ی اصلاح (Surgical, Additive)

### ۱. تقویت `write-cinematic-prompt` برای bridge روایی
در `supabase/functions/ad-director-ai/index.ts` (تابع `handleWriteCinematicPrompt`):
- اضافه کردن block صریح "NARRATIVE CONTINUITY" به user prompt:
  - `previousScene.lastFrameSummary` (آخرین فریم visual کارت قبلی)
  - `previousScene.subjectAction` (action کارت قبلی)
  - `nextSceneBridge` از continuityProfile
- دستور صریح به مدل: "Open this scene from the exact visual state where the previous scene ended. The first 0.5s must visually continue the motion/action/subject pose from previous scene's lastFrameSummary."
- در `WRITE_CINEMATIC_PROMPT_SYSTEM` اضافه کردن: "Each scene MUST narratively pick up from the previous scene's final action — not just match visual style."

### ۲. اضافه‌ی tab/فیلد `lastFrameSummary` per-scene
در همان تابع، خروجی `write_prompt` یک فیلد اختیاری `endsWith` (string ~30 کلمه) برگرداند که خلاصه‌ی فریم پایانی این scene است. این به scene بعدی پاس می‌شود (یعنی `previousScene.endsWith` به جای فقط `prompt.slice(0,200)`).

### ۳. اصلاح `regenerateScene` در `backgroundAdDirectorService.ts`
قبل از ساختن `motionPrompt`:
- پیدا کردن `previousScene = storyboard[idx-1]` و `nextScene = storyboard[idx+1]`
- اضافه کردن **bridge prefix** بعد از continuityPrefix:
  ```
  [Narrative bridge: This scene begins exactly where the previous scene ended — 
   previous scene's final action: "<previousScene.subjectAction>". 
   Continue the same motion/pose seamlessly into this scene's action.]
  ```
- اگر کارت بعدی هم وجود دارد، یک hint اضافه:
  ```
  [Setup for next: Frame the ending so it can flow into "<nextScene.objective>".]
  ```

### ۴. AI bridging برای "Custom prompt..." کاربر
وقتی `customPrompt` پاس داده می‌شود (در `regenerateScene`):
- به جای استفاده‌ی مستقیم، یک فراخوانی سبک به `edit-video-prompt` (یا `write-cinematic-prompt` با scene synthetic) که:
  - ورودی: متن کاربر + `previousScene` + `nextScene` + continuityProfile
  - خروجی: پرامپت bridged
- این یک hop اضافی است ولی کیفیت روایی را تضمین می‌کند. اگر edge function fail شد، fallback به رفتار فعلی.

### ۵. اصلاح `edit-video-prompt` (در `supabase/functions/edit-video-prompt/index.ts`)
- پذیرش parameter اختیاری `previousSceneSummary` و `nextSceneSummary` در body
- تزریق در system/user prompt: "The edited prompt must remain narratively continuous with: previous=<...>, next=<...>"
- تماس‌گیرنده‌ها (`AIPromptDialog`، `ProVideoEditor`) این دو را پاس می‌دهند

### ۶. UI hint کوچک (اختیاری ولی مفید)
- در input "Custom prompt..." روی هر کارت، placeholder را به این تغییر دهیم: "Custom prompt — will continue from previous scene..."
- زیر input یک متن ریز خاکستری: "AI will bridge this with scene N-1 and scene N+1"

## فایل‌های تغییرکننده
- `supabase/functions/ad-director-ai/index.ts` — تقویت `handleWriteCinematicPrompt` + system prompt
- `supabase/functions/edit-video-prompt/index.ts` — پذیرش previous/next context
- `src/lib/backgroundAdDirectorService.ts` — bridge prefix در `regenerateScene` + AI bridging برای customPrompt
- `src/components/ad-director/SceneCard.tsx` — placeholder/hint زیر custom prompt input

## آنچه دست‌نخورده می‌ماند
- Schema/DB / RLS / migrations — بدون تغییر
- Initial pipeline (analyze-script → write-cinematic-prompt → score → improve) — فقط prompt content تقویت می‌شود
- Stitch / export / overlays / transitions — بدون تغییر
- Voiceover / subtitles — بدون تغییر
- زبان UI: کاملاً انگلیسی (طبق memory rule)

## نتیجه
1. ✅ هر کارت ۲ به بعد، بصری **و** روایی از کارت قبلی ادامه پیدا می‌کند (action، subject pose، motion flow)
2. ✅ Regenerate تک‌سینی هم continuity روایی را حفظ می‌کند
3. ✅ "Custom prompt..." کاربر قبل از رفتن به video model، توسط AI با context کارت‌های مجاور bridge می‌شود
4. ✅ Edit پرامپت با دانش از scenes اطراف انجام می‌شود
5. ✅ بدون شکستن هیچ pipeline موجود — اگر AI bridging fail شود، fallback به رفتار فعلی
