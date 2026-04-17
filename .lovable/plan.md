

## درخواست کاربر
ویدئویی که در editor باز شده **صدا دارد** (در preview صدای هر scene پخش می‌شود)، ولی نوار **Audio** خالی است و می‌گوید `No voiceover — open Voice tab to generate`. کاربر می‌خواهد **همیشه** برای هر ویدئویی که audio دارد، نوار آبی Audio به‌طور قطعی نمایش داده شود (و همینطور Music، Text).

## ریشه‌ی ناپایداری (تشخیص قطعی)

با مطالعه‌ی `ProVideoEditor.tsx` (effect خط 686-766) سه باگ پیدا کردم:

### باگ ۱: CORS باعث failure بی‌صدای detection می‌شود
```js
v.crossOrigin = "anonymous";
v.addEventListener("error", () => done(false, 0));
```
وقتی URL از CDN خارجی (Wan/Veo/Kling) بدون CORS header می‌آید → `error` فایر می‌شود → `hasAudio: false` → هیچ track ای ساخته نمی‌شود. این رفتار **non-deterministic** است چون بستگی به CDN دارد.

### باگ ۲: Stale ref در `extractedClipUrlsRef`
```js
if (extractedClipUrlsRef.current.has(url)) continue;
extractedClipUrlsRef.current.add(url);  // mark BEFORE detection
```
URL را **قبل از موفقیت detection** mark می‌کند. اگر detection fail کند، track ساخته نمی‌شود ولی URL در ref باقی می‌ماند → re-run effect → `continue` → **هرگز** retry نمی‌شود. این چرا کاربر می‌گوید "هر بار رفتار متفاوتی" — تابع به race + cache منفی وابسته است.

### باگ ۳: شرط حذف `data:image/` بیش از حد سختگیر
خطوط 712-716: اگر هنوز placeholder باشد، valid نیست. مشکل نیست خودش، ولی دلیل نمایش "no" را در UI پنهان می‌کند.

### باگ ۴: Music lane همیشه خالی برای embedded audio
audio که از clip استخراج می‌شود به‌صورت `kind: "voiceover"` ذخیره می‌شود (در lane آبی)، ولی خود ویدئو ممکن است **music background** هم داشته باشد. کاربر در screenshot هیچ‌کدام را نمی‌بیند.

## برنامه (Surgical, Deterministic)

### ۱. حذف وابستگی به CORS detection
در صورت اطمینان داریم که "اگر clip ویدئویی است، تقریباً همیشه audio دارد" (که خودِ کد همین فرض را با fallback `|| true` گذاشته)، **نیازی به detection async نداریم**. به‌جای آن:

```ts
// Deterministic: every completed video clip → 1 voiceover bar (visual-only)
useEffect(() => {
  if (!storyboard.length) return;
  
  const validClips = clips.filter(c => 
    c.status === "completed" && c.videoUrl && !c.videoUrl.startsWith("data:image/")
  );
  const validUrls = new Set(validClips.map(c => c.videoUrl as string));
  
  setAudioTracks(prev => {
    let changed = false;
    // Cleanup orphan extracted tracks
    let next = prev.filter(t => {
      if (!t.extractedFromVideo) return true;
      const keep = t.audioUrl && validUrls.has(t.audioUrl);
      if (!keep) changed = true;
      return keep;
    });
    
    // Add missing extracted tracks for each valid clip
    for (const clip of validClips) {
      const url = clip.videoUrl as string;
      const sceneIdx = storyboard.findIndex(s => s.id === clip.sceneId);
      if (sceneIdx < 0) continue;
      
      const exists = next.some(t => 
        t.extractedFromVideo && t.audioUrl === url && t.sceneId === clip.sceneId
      );
      if (exists) continue;
      
      const sceneStart = cumulativeStarts[sceneIdx] || 0;
      const sceneDur = sceneDurations[sceneIdx] || 0;
      
      next.push({
        sceneId: clip.sceneId,
        label: `Scene ${sceneIdx + 1} voice`,
        audioUrl: url,
        kind: "voiceover" as const,
        volume: 0,
        globalStartTime: sceneStart,
        duration: sceneDur,
        extractedFromVideo: true,
      });
      changed = true;
    }
    return changed ? next : prev;
  });
}, [clips, storyboard, cumulativeStarts, sceneDurations]);
```

**مزایا:**
- ✅ Synchronous → بدون race
- ✅ Idempotent → چندبار اجرا = یک نتیجه
- ✅ بدون CORS dependency
- ✅ بدون stale ref (`extractedClipUrlsRef` کاملاً حذف می‌شود)
- ✅ هر تغییر در `clips/storyboard/cumulativeStarts/sceneDurations` به‌طور خودکار sync می‌شود (مثلاً بعد از split، بعد از add scene)

### ۲. حذف کامل `extractedClipUrlsRef`
دیگر نیاز نیست. حذف می‌شود تا dead code نماند.

### ۳. حفظ behavior فعلی برای voiceoverUrl/musicTrackUrl props
effect موجود در خط 559-591 (seed از props) دست‌نخورده باقی می‌ماند — درست کار می‌کند.

### ۴. حفظ rule: کاربر اگر track را manually delete کرد، دوباره seed نشود
اضافه‌کردن `userRemovedExtractedRef = useRef<Set<string>>(new Set())`:
- در `handleRemoveAudioTrack` اگر track دارای `extractedFromVideo` بود → `userRemovedExtractedRef.current.add(url)`
- در seed loop: `if (userRemovedExtractedRef.current.has(url)) continue;`

### ۵. (اختیاری—اگر زمان داشتیم) Music lane هم seed شود از clip
چون audio embedded می‌تواند هم voice باشد هم music، فعلاً **رفتار فعلی** را حفظ می‌کنیم: یک bar در Audio lane برای هر clip. کاربر بعداً اگر می‌خواست separately music اضافه کند، از Music dialog استفاده می‌کند.

## فایل‌های تغییرکننده
- `src/components/ad-director/ProVideoEditor.tsx`:
  - بازنویسی effect خط 686-766: حذف async detection، حذف `extractedClipUrlsRef`، deterministic synchronous seed
  - حذف declaration `extractedClipUrlsRef` خط 595
  - اضافه `userRemovedExtractedRef`
  - update `handleRemoveAudioTrack` (خط ~1181) برای ثبت در ref

## آنچه دست‌نخورده می‌ماند
- TimelineBar render logic (آبی Audio lane از قبل درست است)
- voiceoverUrl/musicTrackUrl props seed effect
- Text seeding effect
- Split / Transition / Playback
- DB / RLS
- زبان UI: انگلیسی

## نتیجه‌ی مورد انتظار
1. ✅ هر بار editor باز می‌شود، **هر clip ویدئویی** بلافاصله یک bar آبی در Audio lane دارد
2. ✅ بدون وابستگی به CORS / metadata detection
3. ✅ Idempotent — هیچ duplicate ساخته نمی‌شود
4. ✅ بعد از split / add / regenerate scene، bars خودکار sync می‌شوند
5. ✅ اگر کاربر یک bar را manually پاک کند، re-seed نمی‌شود
6. ✅ رفتار **یکسان و قابل پیش‌بینی** برای همه‌ی پروژه‌ها

