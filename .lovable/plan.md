

## درخواست کاربر
همان قاعده‌ای که الان روی ردیف **Music** درست کار می‌کند (نوار آبی دقیقاً زیر کلیپ ویدئوی مربوطه ظاهر می‌شود، با left و width متناسب با موقعیت scene روی timeline) باید برای ردیف‌های **Text** و **Audio (Voiceover)** هم برقرار باشد.

## یافته‌ی فنی

در `TimelineBar.tsx`:

1. **ردیف Text (خط 940-980):** برای هر overlay متنی:
   - `leftPct = 0` ← اشتباه: همیشه از ابتدای timeline شروع می‌شود
   - `widthPct = (absEnd / totalDuration) * 100` ← عرض از 0 تا انتهای scene محاسبه می‌شود
   - نتیجه: متنی که برای scene 3 است، روی scene 1/2/3 پخش می‌شود

2. **ردیف Audio/Voiceover (خط 998-1051):** همان bug — `leftPct = 0` در هر دو شاخه‌ی شرطی.

3. **ردیف Music (خط 1067-1073):** قبلاً برای `extractedFromVideo` درست شده — `leftPct` با `sceneStart / totalDuration` و `widthPct` با `sceneDur / totalDuration` محاسبه می‌شود. این الگوی درست است.

## برنامه‌ی اصلاح (Surgical, Visual-Only)

### ۱. ردیف Text — استفاده از موقعیت per-scene
در منطق `textOverlays.map` (خط 940-980):
- محاسبه `sceneStart = cumulativeStarts[idx]`
- `leftPct = (sceneStart + itemStart) / totalDuration * 100`
- `widthPct = ((Math.min(itemEnd, sceneDur) - itemStart) / totalDuration) * 100`
- نتیجه: نوار بنفش text دقیقاً زیر کلیپ ویدئویی scene مربوطه ظاهر می‌شود — اگر `startTime/endTime` تعیین شده باشد، فقط همان بازه را پر می‌کند

### ۲. ردیف Audio/Voiceover — همان الگو
در منطق `voiceoverTracks.map` (خط 998-1015):
- شاخه‌ی `globalStartTime != null`: 
  - `leftPct = (globalStartTime / totalDuration) * 100` (به جای 0)
  - `widthPct = (trackDur / totalDuration) * 100` (فقط طول track، نه globalStartTime + trackDur)
- شاخه‌ی fallback (بر اساس sceneId):
  - `leftPct = ((sceneStart + (track.startTime ?? 0)) / totalDuration) * 100`
  - `widthPct = ((Math.min(itemEnd, sceneDur) - (track.startTime ?? 0)) / totalDuration) * 100`
- نتیجه: نوار سبز/سایان voiceover دقیقاً زیر scene مربوطه قرار می‌گیرد

### ۳. هم‌سو کردن Music دستی (non-extracted)
شاخه‌ی `globalStartTime != null` در music هم همان bug ظاهری را دارد (`leftPct = 0`). به همان الگو اصلاح می‌شود تا music های دستی با `globalStartTime` هم در جای درست شروع شوند. Music های full-width (بدون globalStartTime یا extracted: false بدون globalStartTime) دست‌نخورده می‌مانند (همان رفتار full-width فعلی).

### ۴. حداقل عرض و کلیپ گذاری
- `Math.max(widthPct, 0.8)` نگه داشته می‌شود تا نوارهای خیلی کوتاه قابل دیدن باشند
- اگر `leftPct + widthPct > 100`، `widthPct` با `100 - leftPct` cap می‌شود تا از overflow جلوگیری شود

## فایل‌های تغییرکننده
- `src/components/ad-director/editor/TimelineBar.tsx` — فقط بخش محاسبه‌ی `leftPct/widthPct` در سه map (text, voiceover, music-non-extracted)

## آنچه دست‌نخورده می‌ماند
- منطق drag/drop, trim, delete, edit overlay
- منطق playback (voiceover/music timing از داده‌ی track می‌آید، نه از موقعیت بصری)
- export/stitch pipeline
- ردیف ویدئو، split siblings، playhead، transport bar
- DB / RLS / edge functions

## نتیجه
1. ✅ هر overlay متن دقیقاً زیر scene مربوطه روی ردیف Text ظاهر می‌شود (با offset درست از چپ)
2. ✅ هر voiceover track دقیقاً زیر scene مربوطه روی ردیف Audio ظاهر می‌شود
3. ✅ Music های دستی با globalStartTime هم در جای درست
4. ✅ هیچ تغییری در playback یا export
5. ✅ زبان UI: انگلیسی (طبق memory rule)

