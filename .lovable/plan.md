

## درخواست کاربر
در صفحه‌ی **Edit Video** (AdDirector editor):
1. ویدئو باید کامل (تمام scene ها به‌صورت پیوسته) در preview نمایش داده شود — نه فقط یک scene
2. Text / Voice / Music باید به‌صورت نوارهای رنگی روی timeline دیده شوند
3. وقتی کاربر هر نواری را حذف می‌کند، باید از پخش حذف شود

## بررسی کد فعلی

نیاز به مطالعه‌ی این فایل‌ها:
- `src/components/ad-director/AdDirectorContent.tsx` (editor wrapper)
- timeline و preview components

می‌سازم plan مختصر بر اساس آنچه از screenshot ها مشخص است:

### مشکلات قابل مشاهده در screenshot
1. **Preview**: فقط Scene 1 (یا اولین clip) نمایش داده می‌شود؛ Scene 2 نمی‌آید — یعنی preview از یک `<video>` تک‌منبعی استفاده می‌کند، نه از یک playlist/composition.
2. **Timeline**: 
   - Video lane هست ✅
   - Text lane: "double-click a clip to add subtitles" — یعنی اگر متن وجود دارد، نوار رنگی نشان نمی‌دهد
   - Audio lane: "open Voice tab to generate" — حتی اگر voice generate شده باشد، block رنگی روی lane نیست
   - Music lane: Scene 2 audio به‌عنوان music ست شده ❌ (label اشتباه — این voiceover است نه music)
3. **حذف**: مکانیسم حذف per-track block وجود ندارد یا روی playback اعمال نمی‌شود.

## برنامه (Surgical, focused on Edit Video screen)

### ۱. Sequential preview playback
در preview component:
- به‌جای پخش یک `videoUrl` تنها، یک playlist از تمام clip ها به ترتیب scene ها ساخته شود
- وقتی یک clip تمام شد، خودکار به clip بعدی برود (`onEnded` → next index)
- timeline scrubber هم بر اساس total duration حرکت کند، نه per-clip
- موقع seek، clip درست انتخاب و به offset مناسب پرش کند

### ۲. نوارهای رنگی برای Text / Voice / Music
هر lane باید block های رنگی واقعی نشان دهد:
- **Video lane** (سبز): همان clip blocks فعلی ✅
- **Text lane** (آبی): per-scene subtitle/text overlay ها — هر scene یک block آبی به طول همان scene
- **Voice lane** (بنفش): per-scene voiceover audio — هر scene که `voiceUrl` دارد، block بنفش به طول duration آن
- **Music lane** (نارنجی): background music track — یک block سراسری به طول کل ویدئو

اگر یک lane خالی است، placeholder خاکستری (مثل الان) بماند؛ ولی اگر داده هست، block رنگی نمایش داده شود.

### ۳. حذف block ها و اعمال روی playback
- هر block یک دکمه‌ی X کوچک یا context menu برای حذف داشته باشد
- state حذف per-block در project state (مثل `disabledTracks: Set<string>`) نگه‌داری شود
- preview playback این state را respect کند:
  - Text disabled → overlay render نشود
  - Voice disabled → audio element mute/unmount شود
  - Music disabled → music element mute/unmount شود
  - Video clip disabled → از playlist skip شود
- export/render pipeline هم همین state را respect کند

### ۴. اصلاح label اشتباه
"Scene 2 audio" که الان زیر Music نشسته باید به Voice lane منتقل شود (voiceover است، نه music). فقط background music track (در صورت وجود) در Music lane بماند.

## فایل‌های احتمالاً تغییرکننده
- `src/components/ad-director/AdDirectorContent.tsx` — entry به editor
- `src/components/ad-director/editor/*` — preview player, timeline, lanes
- state hook که project clips/tracks را نگه می‌دارد (احتمالاً `useAdDirectorProject` یا مشابه)
- export/stitch path فقط در حدی که disabled tracks را skip کند

## آنچه دست‌نخورده می‌ماند
- Veo / Wan / Sora generation flow
- DB schema / RLS
- Scene generation و prompt engineering
- زبان UI: انگلیسی

## نتیجه‌ی مورد انتظار
1. ✅ کل ویدئو (همه scene ها) به‌صورت پیوسته در preview پخش می‌شود
2. ✅ Text / Voice / Music هر کدام block رنگی واقعی روی timeline دارند
3. ✅ حذف هر block بلافاصله از preview حذف می‌کند
4. ✅ Export نهایی هم همان state را respect می‌کند
5. ✅ Voiceover دیگر اشتباهاً در Music lane نمایش داده نمی‌شود

