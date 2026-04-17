

## درک درخواست
کاربر روی آیکون **regenerate** (آیکون قرمز شده در گوشه‌ی thumbnail هر صحنه) اشاره می‌کند. می‌گوید وقتی این آیکون زده شود، باید **همان صحنه دوباره با همان پرامت اولیه** از نو ساخته شود (regenerate).

## بررسی کد فعلی
<lov-tool-use id="toolu_vrtx_01C69KSkYuLEAVyDLzSMG7p4" name="code--search_files" integration-id="code" data="{\"query\": \"Generated Scenes\", \"include_patterns\": \"src/components/ad-director/**\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01DZuzpkX9oRX2thXpEZ5MAf" name="code--search_files" integration-id="code" data="{\"query\": \"RefreshCw|RotateCw|regenerate\", \"include_patterns\": \"src/components/ad-director/**\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01XhtQo9iL9GcEMjEjTj6uRF" name="code--search_files" integration-id="code" data="{\"query\": \"Generated Scenes\", \"include_patterns\": \"src/components/ad-director/**\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_015zr3LsmXAjBSaiERAaigVH" name="code--search_files" integration-id="code" data="{\"query\": \"RefreshCw|RotateCw|regenerate\", \"include_patterns\": \"src/components/ad-director/**\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01GThYjEVFjRejo9Z96zGBvN" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/ad-director/AdDirectorContent.tsx\", \"lines\": \"500-620\"}">
</lov-tool-use>
The icon (RefreshCw) at top-right of each scene card already triggers `handleRegenerateScene(clip.sceneId)`. The user says when clicked it should re-create the video using the **original prompt**. Let me see what `handleRegenerateScene` does — does it use the existing/custom prompt or the original?
<lov-tool-use id="toolu_vrtx_01174QxwjqhqwDuHNh5EEKQZ" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/components/ad-director/AdDirectorContent.tsx,src/lib/backgroundAdDirectorService.ts\", \"query\": \"handleRegenerateScene|regenerateScene\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_0147UfnT2xZ8oVhpnttiAavd" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/ad-director/AdDirectorContent.tsx\", \"lines\": \"275-360\"}">
</lov-tool-use>
Now I have a clear picture. The current `handleRegenerateScene` already uses `scene.prompt` (the original) when `customPrompt` is empty — so clicking the icon already does send the original prompt. **But** there are real issues:

1. It hardcodes `provider: "wan", model: "wan2.6-t2v"` — text-to-video, **ignoring `characterImageUrl`** (i2v). So the regenerated video drops the character reference completely.
2. It doesn't pass `characterImageUrl`, `characterPrompt`, `brandContext`, the CHARACTER LOCK header, negative-prompt enhancements, or continuity prefix that the main pipeline uses.
3. So when user clicks the refresh icon, a totally different t2v video is generated without character lock — exactly the user's complaint that it makes a "different character".

Let me look at how the main pipeline builds these prompts so I can mirror them.
<lov-tool-use id="toolu_vrtx_01TFwXUzTvEofaBG9JapYsie" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/lib/backgroundAdDirectorService.ts\", \"query\": \"characterImageUrl|CHARACTER LOCK|generate-video\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01UoQ6tsQFKedFjULFJZfcST" name="code--view" integration-id="code" data="{\"file_path\": \"src/lib/backgroundAdDirectorService.ts\", \"lines\": \"480-580\"}">
</lov-tool-use>
Now I have enough. Let me check what state fields are accessible (characterImageUrl, etc.) and how getState exposes them:
<lov-tool-use id="toolu_vrtx_01PVovchzpRVuCvGwe5XYnP5" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/lib/backgroundAdDirectorService.ts\", \"query\": \"interface PipelineState|characterImageUrl:|introImageUrl:|outroImageUrl:|characterPrompt:|videoProvider|videoModel\"}">
</lov-tool-use>
So `characterImageUrl`, `videoProvider`, `videoModel` are local variables in `startPipeline`, **not stored in state**. The `handleRegenerateScene` callback has no access to them after pipeline completes. I need to find what state DOES persist for regenerate access.
<lov-tool-use id="toolu_vrtx_01DaMxJQufNfT7vi9W9k8VC8" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/lib/backgroundAdDirectorService.ts\", \"query\": \"PipelineState =|export interface|export type PipelineState\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Dh58bj8qmN8B5KjAKs8Vqs" name="code--view" integration-id="code" data="{\"file_path\": \"src/lib/backgroundAdDirectorService.ts\", \"lines\": \"55-130\"}">
</lov-tool-use>
Now I have full picture. The state doesn't persist `characterImageUrl`, `introImageUrl`, `outroImageUrl`, `characterPrompt`, `videoProvider`, `videoModel`, `continuityProfile`. So when handleRegenerateScene runs, it can't reproduce the original prompt configuration.

I have enough context to present the plan.

<lov-plan>

## ریشه‌ی مشکل
آیکون refresh روی scene card تابع `handleRegenerateScene` (در `AdDirectorContent.tsx` خط 277) را صدا می‌زند. این تابع **با پایپلاین اصلی همسو نیست**:

| موضوع | پایپلاین اصلی (`backgroundAdDirectorService`) | regenerate فعلی |
|---|---|---|
| Provider/Model | داینامیک: i2v اگر character دارد، t2v اگر ندارد | hardcoded: `wan2.6-t2v` (همیشه t2v) |
| `imageUrl` (character ref) | پاس داده می‌شود | **هرگز پاس داده نمی‌شود** |
| CHARACTER LOCK header | تزریق می‌شود | غایب |
| Continuity prefix | اضافه می‌شود | غایب |
| Negative prompt تقویت‌شده برای i2v | بله | فقط base |
| Character direction | تزریق می‌شود | غایب |
| Intro/outro reference image | بررسی می‌شود | غایب |

**نتیجه:** کلیک روی refresh یک ویدیوی t2v کاملاً بدون رفرنس می‌سازد → چهره و شخصیت متفاوت می‌شود (دقیقاً شکایت کاربر).

## دلیل دوم
state سرویس (`AdDirectorPipelineState`) فیلدهای زیر را **ذخیره نمی‌کند**: `characterImageUrl`, `introImageUrl`, `outroImageUrl`, `characterPrompt`, `videoProvider`, `videoModel`, `continuityProfile`. این مقادیر فقط در closure تابع `startPipeline` زندگی می‌کنند، پس بعد از پایان پایپلاین قابل بازیابی برای regenerate نیستند.

---

## برنامه اصلاحی (دو فایل)

### فایل ۱ — `src/lib/backgroundAdDirectorService.ts`

**A. توسعه‌ی `AdDirectorPipelineState`** با فیلدهای جدید (همه اختیاری برای backward compat):
```ts
characterImageUrl?: string | null;
introImageUrl?: string | null;
outroImageUrl?: string | null;
characterPrompt?: string | null;
videoProvider?: string | null;
videoModel?: string | null;
```

**B. در `startPipeline` (حدود خط 220)** بعد از آپلود تصاویر، آن‌ها را در state بنویسیم:
```ts
this.update({ characterImageUrl, introImageUrl, outroImageUrl, characterPrompt, videoProvider, videoModel });
```

**C. اضافه کردن متد جدید `regenerateScene(sceneId, customPrompt?)` در سرویس** که دقیقاً همان منطق پایپلاین اصلی را اجرا می‌کند:
- خواندن `characterImageUrl/intro/outro/characterPrompt/videoProvider/videoModel/continuity` از state
- ساخت `referenceImage` با همان priority (intro برای scene اول، outro برای آخرین، character برای بقیه)
- تعیین i2v vs t2v بر اساس وجود `referenceImage`
- اعمال `continuityPrefix` + `CHARACTER LOCK header` + `motionPrompt` + `character direction`
- پاس دادن `imageUrl` به edge function وقتی i2v
- اعمال negative prompt تقویت‌شده
- polling در صورت async job
- اگر `customPrompt` خالی باشد → از `scene.prompt` اصلی استفاده می‌شود (همان رفتار فعلی، ولی این بار با همه‌ی پارامترها)

### فایل ۲ — `src/components/ad-director/AdDirectorContent.tsx`

**جایگزینی کامل بدنه‌ی `handleRegenerateScene` (خطوط 277-365)** با یک خط:
```ts
const handleRegenerateScene = useCallback(async (sceneId: string, customPrompt?: string) => {
  setApproved(false);
  await service.regenerateScene(sceneId, customPrompt);
}, []);
```

تمام منطق به سرویس منتقل می‌شود — single source of truth برای generation logic.

---

## نتیجه پس از اصلاح

با کلیک روی آیکون refresh روی هر scene:
1. ✅ همان `scene.prompt` اولیه استفاده می‌شود (پرامت اصلی)
2. ✅ اگر character image داشته باشید، **i2v با همان عکس** ساخته می‌شود
3. ✅ CHARACTER LOCK header تزریق می‌شود → چهره عوض نمی‌شود
4. ✅ Negative prompt تقویت‌شده جلوی identity drift را می‌گیرد
5. ✅ Continuity prefix حفظ می‌شود → سبک بصری ثابت می‌ماند
6. ✅ Custom prompt input هم همچنان کار می‌کند (override پرامت)

## آنچه تغییر **نمی‌کند**
- UI و آیکون refresh — بدون تغییر
- Edge functions (`generate-video`, `ad-director-ai`) — بدون تغییر
- DB schema و RLS — بدون تغییر
- Background indicator و wake lock — بدون تغییر
- Custom prompt input ارسال — بدون تغییر در رفتار

