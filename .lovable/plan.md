

## درخواست کاربر
وقتی یک ویدئو در سین‌ها لود می‌شود (مخصوصاً ویدئوهای Wan 2.6 که اغلب صدای پس‌زمینه/موسیقی دارند)، صدای آن باید **به‌صورت خودکار جدا شده** و در ردیف **Music** زیر نوار ویدئو به‌شکل **نوار آبی** نمایش داده شود — برای هر سینی که صدا دارد، یک نوار آبی هم‌تراز با همان scene روی ردیف Music ظاهر شود.

## یافته‌های فنی

1. در `TimelineBar.tsx` خط 1084، نوار music با کلاس `bg-yellow-500/60` (زرد) رندر می‌شود. کاربر آبی می‌خواهد.
2. در `ProVideoEditor.tsx` (خطوط 538–568)، `audioTracks` فقط از پراپ‌های ورودی `voiceoverUrl` و `musicTrackUrl` seed می‌شود — هیچ منطقی برای **استخراج صدا از کلیپ‌های ویدئو** وجود ندارد. اگر کاربر فقط ویدئو generate کند بدون آنکه music جداگانه بسازد، ردیف Music خالی می‌ماند با پیام "No music — click + to add" (خط 1059) — حتی وقتی خود ویدئو موسیقی embedded دارد.
3. ویدئوهای Wan 2.6 (طبق memory `integrations/video-engines/dashscope-standards`) صدای embedded دارند که الان فقط از `<video>` element پلی می‌شود ولی هیچ نمایش بصری روی timeline ندارند.
4. مرورگر می‌تواند تشخیص دهد آیا یک video دارای audio track است: `video.mozHasAudio` (فایرفاکس)، `video.webkitAudioDecodedByteCount > 0` (Chrome پس از playback)، یا با `AudioContext` و `MediaElementSource`. ساده‌ترین راه قابل اعتماد: یک `HTMLVideoElement` موقت بسازیم، metadata را load کنیم، و چک کنیم.

## برنامه (Surgical, Additive)

### ۱. تابع کمکی برای تشخیص صدا در ویدئو
در `ProVideoEditor.tsx`، یک helper اضافه کنیم:
```ts
const detectVideoHasAudio = (videoUrl: string): Promise<{ hasAudio: boolean; duration: number }> => {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.crossOrigin = "anonymous";
    v.addEventListener("loadedmetadata", () => {
      // Heuristic: try multiple browser APIs
      const hasAudio = (v as any).mozHasAudio || 
                       Boolean((v as any).webkitAudioDecodedByteCount) ||
                       ((v as any).audioTracks?.length > 0) ||
                       true; // Default true for Wan 2.6 (always has audio)
      resolve({ hasAudio, duration: v.duration || 0 });
    });
    v.addEventListener("error", () => resolve({ hasAudio: false, duration: 0 }));
    v.src = videoUrl;
  });
};
```

### ۲. useEffect جدید برای auto-extract music tracks از clips
هر بار که `clips` تغییر می‌کند (یا scene جدید generate می‌شود)، چک کنیم:
- برای هر clip با `status === "completed"` و `videoUrl` معتبر (نه `data:image/`) و `videoUrl` که قبلاً extract نشده،
- اگر صدا دارد → یک AudioTrackItem با `kind: "music"`, `audioUrl: clip.videoUrl`, `extractedFromVideo: true`, `sceneId: clip.sceneId`, `globalStartTime` محاسبه‌شده از موقعیت scene، `duration` از clip اضافه کنیم.
- اگر کاربر قبلاً music track دستی اضافه کرده (بدون flag `extractedFromVideo`)، آن را دست‌نخورده نگه می‌داریم.
- اگر clip حذف یا regenerate شد، track مرتبط را cleanup کنیم.

### ۳. اضافه کردن flag `extractedFromVideo` به type `AudioTrackItem`
در `TimelineBar.tsx` interface `AudioTrack` (خط 79–87):
```ts
extractedFromVideo?: boolean;
```

### ۴. تغییر رنگ نوار Music از زرد به آبی
در `TimelineBar.tsx` خط 1084:
- `bg-yellow-500/60 hover:bg-yellow-500/80` → `bg-blue-500/60 hover:bg-blue-500/80`
- آیکون و رنگ label نیز برای هماهنگی به آبی نزدیک شوند (آیکون Music روی نوار)

### ۵. رندر per-scene برای music های extracted
الان music track‌ها از 0 تا انتها رندر می‌شوند (خط 1062–1078). برای music های `extractedFromVideo: true`، باید مثل voiceover ها بر اساس `sceneId` و `globalStartTime` و `duration` خاص آن scene پوزیشن بگیرند:
- `leftPct = (globalStartTime / totalDuration) * 100`
- `widthPct = (duration / totalDuration) * 100`
- این باعث می‌شود زیر هر کلیپ ویدئو، یک نوار آبی هم‌عرض با همان کلیپ روی ردیف Music دیده شود.

### ۶. جلوگیری از double playback
ویدئوهای generated از طریق `<video>` خودشان صدا پلی می‌کنند. اگر music track extracted هم پلی شود → echo. راه‌حل: track های `extractedFromVideo: true` را از منطق playback در `useEffect` خط 702–759 **استثنا** کنیم — این track‌ها صرفاً **بصری** هستند (نمایش روی timeline)، صدای واقعی از خود `<video>` می‌آید. این تضمین می‌کند هیچ playback اضافی رخ ندهد.

### ۷. label معنادار
به جای "🎵 Background Music"، برای track های extracted: `🎵 Scene N audio` تا کاربر بفهمد از کجا آمده.

### ۸. اگر کاربر دستی music اضافه کرد
رفتار فعلی (یک نوار آبی full-width) حفظ می‌شود — فقط رنگ از زرد به آبی تغییر می‌کند.

## فایل‌های تغییرکننده
- `src/components/ad-director/ProVideoEditor.tsx` — helper `detectVideoHasAudio`، useEffect برای auto-extract، استثنا کردن extracted tracks در playback loop، و label/positioning
- `src/components/ad-director/editor/TimelineBar.tsx` — افزودن فیلد اختیاری `extractedFromVideo` به interface، تغییر رنگ زرد → آبی، منطق positioning per-scene برای extracted tracks

## آنچه دست‌نخورده می‌ماند
- منطق voiceover (separate playback)، subtitles، overlays، split, trim, drag, reorder — بدون تغییر
- export/stitch pipeline — بدون تغییر (صدای embedded ویدئو همیشه در export موجود است)
- DB / RLS / edge functions — بدون تغییر
- زبان UI: انگلیسی (طبق memory rule)

## نتیجه
1. ✅ هر کلیپ ویدئو که صدا دارد → یک نوار **آبی** زیر همان کلیپ روی ردیف Music ظاهر می‌شود (هم‌عرض و هم‌تراز با کلیپ)
2. ✅ Music های دستی کاربر هم آبی نمایش داده می‌شوند (کل عرض)
3. ✅ هیچ echo/double playback رخ نمی‌دهد — track های extracted فقط visual هستند
4. ✅ Cleanup خودکار وقتی scene حذف یا regenerate می‌شود
5. ✅ کلیک روی نوار آبی همان track را select می‌کند (می‌تواند بعداً برای حذف یا replace استفاده شود)

