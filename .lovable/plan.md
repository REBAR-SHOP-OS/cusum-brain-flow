

## درخواست کاربر
بخش timeline (نوارهای Text / Audio / Music) **ناپایدار** است — هر بار که یک ویدئو وارد editor می‌شود رفتار متفاوتی دارد. کاربر می‌خواهد:
- **همیشه** و به‌طور قطعی، اگر ویدئو دارای text باشد → نوار آبی Text نشان داده شود
- اگر ویدئو دارای voice/voiceover باشد → نوار بنفش Audio نشان داده شود  
- اگر ویدئو دارای music باشد → نوار سبز/نارنجی Music نشان داده شود
- این رفتار باید **deterministic** باشد، نه تصادفی

## بررسی کد فعلی

نیاز به مطالعه:
- `src/components/ad-director/ProVideoEditor.tsx` — جایی که tracks برای lanes ساخته می‌شوند (`seededTextScenesRef`, voice tracks, music)
- `src/components/ad-director/editor/TimelineBar.tsx` — render نوارها

از conversation history می‌دانم:
- `seededTextScenesRef` برای auto-seed text blocks اضافه شد (در یک effect)
- voice tracks از `extractedFromVideo` می‌آیند
- مشکل احتمالی: effect هایی که seed می‌کنند **یک بار** اجرا می‌شوند و اگر `storyboard` بعداً تغییر کند (مثلاً scene اضافه شود، split شود، یا ویدئو جدید load شود)، tracks جدید seed نمی‌شوند

## ریشه‌ی ناپایداری (تشخیص)

سه دسته باگ محتمل:

1. **Seeding یک‌باره با `Ref`**: اگر `seededTextScenesRef.current.has(sceneId)` چک می‌شود، scene های جدید بعد از mount اولیه هرگز text نمی‌گیرند. ولی اگر storyboard کامل عوض شود (پروژه جدید)، ref خالی نمی‌شود → scene های پروژه جدید با id متفاوت seed می‌شوند، ولی اگر id ها clash کنند، نه.

2. **شرط seed**: متن از `scene.voiceover || segment.text` می‌آید. اگر هر دو خالی باشند (مثلاً پروژه‌ای که فقط prompt دارد ولی voiceover generate نشده)، هیچ block ساخته نمی‌شود → کاربر می‌بیند "double-click a clip to add subtitles".

3. **Voice tracks فقط برای `extractedFromVideo`**: اگر voice به‌صورت TTS generate شده ولی به‌عنوان `extractedFromVideo` flag نخورده، در lane دیده نمی‌شود.

4. **Music**: اگر music URL در پروژه باشد ولی به lane mapping نشود.

## برنامه (Surgical, Deterministic)

### ۱. Deterministic auto-population effect
یک effect جامع که هر زمان `storyboard` یا `clips` تغییر می‌کند، **idempotent** اجرا می‌شود:

```ts
useEffect(() => {
  storyboard.forEach((scene, idx) => {
    // Text lane
    const hasTextBlock = textBlocks.some(b => b.sceneId === scene.id);
    const textContent = scene.voiceover || scene.subtitle || scene.prompt;
    if (!hasTextBlock && textContent) {
      addTextBlock({ sceneId: scene.id, content: textContent, ... });
    }
    
    // Voice/Audio lane — هر scene که voiceUrl یا extracted audio دارد
    const hasVoiceTrack = audioTracks.some(t => t.sceneId === scene.id && t.kind === 'voiceover');
    if (!hasVoiceTrack && (scene.voiceUrl || clips[idx]?.hasAudio)) {
      addAudioTrack({ sceneId: scene.id, kind: 'voiceover', ... });
    }
  });
  
  // Music lane — یک بار سراسری
  if (project.musicUrl && !musicTrack) {
    setMusicTrack({ url: project.musicUrl, duration: totalDuration });
  }
}, [storyboard, clips, project.musicUrl]);
```

این effect:
- بدون `Ref` کار می‌کند → idempotent
- وقتی scene جدید اضافه/split/load می‌شود، خودکار seed می‌کند
- duplicate نمی‌سازد چون `hasTextBlock`/`hasVoiceTrack` چک می‌کند

### ۲. شرط محتوا برای Text
به جای فقط `voiceover`، چند fallback:
- `scene.voiceover` (اگر TTS script هست)
- `scene.subtitle` (اگر subtitle جدا تعریف شده)
- `scene.caption`
- `scene.prompt` (آخرین fallback — همیشه موجود است)

→ تضمین می‌شود **هر scene** حداقل یک text block دارد.

### ۳. شرط محتوا برای Voice/Audio
- `scene.voiceUrl` (TTS generated)
- `clip.audioUrl` (extracted from video)
- `clip.hasAudio === true` (video دارای audio است)

→ هر scene که هر یک را دارد، یک audio block می‌گیرد.

### ۴. Music lane
- اگر `project.musicUrl` یا `project.backgroundMusic` تعریف شده → یک block سراسری به طول کل ویدئو
- اگر نیست → placeholder خاکستری "No music — click + to add" (همان رفتار فعلی)

### ۵. پاکسازی هنگام تغییر پروژه
وقتی project ID عوض می‌شود (یا storyboard کامل reset می‌شود):
- `seededTextScenesRef.current.clear()` — ولی چون به ref وابسته نیستیم دیگر، این مشکل خود به خود حل می‌شود
- Block های قدیمی که scene شان دیگر وجود ندارد → cleanup:
```ts
const validSceneIds = new Set(storyboard.map(s => s.id));
setTextBlocks(prev => prev.filter(b => validSceneIds.has(b.sceneId)));
setAudioTracks(prev => prev.filter(t => validSceneIds.has(t.sceneId)));
```

### ۶. حفظ حذف دستی کاربر
اگر کاربر یک text/audio block را **به‌طور دستی حذف کرد**، دوباره seed نشود:
- یک Set جدید: `userRemovedBlocks: Set<string>` (key = `${sceneId}:${kind}`)
- در handler حذف: `userRemovedBlocks.add('${sceneId}:text')`
- در effect seed: `if (!userRemovedBlocks.has('${scene.id}:text')) addBlock(...)`

این مهم است چون اگر کاربر text را حذف کرد و effect دوباره اجرا شد، نباید برگردد.

## فایل‌های تغییرکننده
- `src/components/ad-director/ProVideoEditor.tsx`:
  - حذف `seededTextScenesRef` (یا تبدیل به `userRemovedBlocksRef`)
  - effect جدید deterministic برای seed تمام lanes
  - cleanup orphan blocks
  - handler حذف → ثبت در `userRemovedBlocks`

## آنچه دست‌نخورده می‌ماند
- `TimelineBar.tsx` — رفتار render نوارها (آیکون‌ها، رنگ‌ها) درست است
- Split / Transition / Playback logic
- Scene generation pipeline
- Veo / Wan / Sora
- DB / RLS
- زبان UI: انگلیسی

## نتیجه‌ی مورد انتظار
1. ✅ هر بار ویدئو وارد editor می‌شود، نوارهای Text / Audio / Music **به‌طور قطعی** seed می‌شوند
2. ✅ هر scene که محتوای text دارد → نوار آبی
3. ✅ هر scene که voice/audio دارد → نوار بنفش
4. ✅ پروژه که music دارد → نوار music سراسری
5. ✅ حذف دستی کاربر respect می‌شود (re-seed نمی‌شود)
6. ✅ Scene های جدید (add / split) خودکار lanes جدید می‌گیرند
7. ✅ رفتار **یکسان و قابل پیش‌بینی** در همه‌ی پروژه‌ها

