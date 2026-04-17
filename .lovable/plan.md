
## درک درخواست کاربر
کاربر یک عکس از یک **شخصیت ثابت** را در «Character reference» آپلود می‌کند و انتظار دارد:
1. **همان چهره** در همه‌ی scene‌ها ظاهر شود (نه شخص دیگر)
2. آن شخصیت **بر اساس prompt صحبت کند** و تبلیغ شرکت را ارائه دهد (با صدا)

## بررسی یافته‌ها

### مشکل ۱ — Character image در همه‌ی scene‌ها استفاده نمی‌شود
در `backgroundAdDirectorService.ts` (خط ~521 و ~618):
```ts
} else if (characterImageUrl && scene.generationMode === "image-to-video") {
  referenceImage = characterImageUrl;
}
```
- اگر AI mode را روی `text-to-video` یا `reference-continuation` بگذارد → عکس شخصیت **هرگز استفاده نمی‌شود**
- اگر intro/outro هم آپلود شده، آن‌ها character را در scene اول/آخر **override** می‌کنند

### مشکل ۲ — هیچ صدای گوینده‌ای تولید نمی‌شود
کل پایپلاین generation هیچ مسیر TTS/voiceover ندارد. خروجی Wan2.6-i2v یک ویدیوی **بدون صدا/بدون lip-sync** است. برای «صحبت کردن شخصیت» نیاز به یکی از این‌هاست:
- **Voiceover overlay** (ساده): تولید صدا با Lovable AI/ElevenLabs از روی متن `narrationLine` هر scene و mux کردن روی ویدیوی Wan
- **Lip-sync** (پیشرفته‌تر): استفاده از مدل talking-head مثل Wan2.6 با voice یا یک مدل lip-sync جداگانه — در فاز ۲

## برنامه (Surgical, دو فاز)

### فاز ۱ — اطمینان از حضور شخصیت در همه scene‌ها (الان)

**`src/lib/backgroundAdDirectorService.ts`** — خطوط 516-523 و 613-620:

تغییر منطق انتخاب reference image. اگر `characterImageUrl` تعریف شده باشد، **همیشه** به‌عنوان reference استفاده شود (با اولویت‌بندی صحیح):
```ts
let referenceImage: string | undefined;
// Priority: intro/outro overrides character ONLY for the specific anchor scene
if (isFirstScene && introImageUrl) {
  referenceImage = introImageUrl;
} else if (isLastVisualScene && outroImageUrl) {
  referenceImage = outroImageUrl;
} else if (characterImageUrl) {
  // Use character for ALL middle scenes — regardless of generationMode
  referenceImage = characterImageUrl;
}
// Force I2V mode whenever we have a reference image
const isI2V = !!referenceImage;
const chosenModel = videoModel || (isI2V ? "wan2.6-i2v" : "wan2.6-t2v");
```

علاوه بر این، در `storyboardWithDefaults` (خط ~412) شرط forcedI2V را گسترش می‌دهیم تا اگر `characterImageUrl` وجود دارد، **همه** scene‌ها (به جز end-card) به `image-to-video` تبدیل شوند:
```ts
const forcedI2V =
  (isFirstScene && !!introImageUrl) ||
  (isLastVisualScene && !!outroImageUrl) ||
  (!!characterImageUrl && s.generationMode !== "static-card");
```

### فاز ۲ — اضافه کردن Narration/Voiceover (در همین تغییر)

**۱. تولید صدا برای هر scene:**  
edge function جدید `generate-narration` که از Lovable AI Gateway برای TTS استفاده می‌کند (مدل: `google/gemini-2.5-flash` با خروجی audio، یا fallback به Web Speech API در client). متن narration از `segment.narrationLine` یا `scene.objective` گرفته می‌شود.

**۲. Mux کردن صدا روی ویدیو:**  
بعد از تکمیل scene در `backgroundAdDirectorService.ts`، یک تابع کمکی `attachNarrationToScene(videoUrl, narrationText, language)` صدا می‌زنیم که با ffmpeg.wasm (یا مستقیماً در browser با Web Audio API + MediaRecorder) صدا را روی ویدیو سوار می‌کند.

**۳. Voice settings در UI:**  
یک toggle ساده در `ChatPromptBar.tsx` با عنوان «🎙️ Voiceover» (پیش‌فرض: ON اگر character آپلود شده). همچنین یک select برای زبان (English / Persian).

### فاز ۳ — Lip-sync (آینده، اختیاری)
بررسی موتورهای talking-head (مثل Wan2.6 talking-head، Hedra، D-ID). نیاز به API key جدید و outside scope این تغییر — فقط placeholder در state می‌گذاریم.

## آنچه تغییر نمی‌کند
- UI کارت‌های reference (`ReferenceUploadCard`) — بدون تغییر
- منطق intro/outro reference — بدون تغییر، فقط اولویت‌بندی نسبت به character روشن می‌شود
- Schema `ad_projects` — بدون تغییر

## نتیجه
وقتی کاربر یک عکس به Character reference می‌دهد:
1. **همان چهره** در همه scene‌ها (به جز end-card و scene‌هایی که intro/outro override دارند) ظاهر می‌شود — با force به `image-to-video` و `wan2.6-i2v`
2. **یک voiceover** بر اساس متن narration هر scene تولید می‌شود و روی ویدیوی نهایی mux می‌شود
3. شخصیت در ویدیو دیده می‌شود + صدای ارائه‌ی تبلیغ شنیده می‌شود
