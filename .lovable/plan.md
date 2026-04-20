

## درخواست کاربر
کاربر transition انتخاب می‌کند (Cross fade, Cross blur, Fade black, Fade white, Wipe Up/Down/Left/Right, Slide Up/Down, Zoom In/Out) ولی **هیچ کدام واقعاً اجرا نمی‌شوند** — نه در preview نه در export.

## ریشه‌ی مشکل (تشخیص قطعی)

با مطالعه‌ی کد سه باگ مستقل:

### باگ ۱: Preview transition — hardcoded fade
در `ProVideoEditor.tsx` خط ۱۶۰۳ تابع `advanceToNextScene`:
```js
setSceneTransition(true);  // فقط opacity 0
setTimeout(() => { ... }, 500);  // همیشه 500ms
```
هیچ‌جا `clipTransitions[sceneId]` خوانده نمی‌شود. نوع و duration انتخابی کاربر **کاملاً نادیده گرفته می‌شود**.

### باگ ۲: Export — فقط crossfade alpha-blend
در `src/lib/videoStitch.ts` خط ۶۴۶-۶۷۵: تنها transition پشتیبانی‌شده، **alpha blending** بین دو clip است (`globalAlpha = 1 - progress`). هیچ منطقی برای blur, fade-to-black, fade-to-white, wipes, slides, zoom وجود ندارد. همچنین `clipTransitions` به stitcher pass نمی‌شود — فقط `crossfadeDuration` global.

### باگ ۳: متغیر transition انتخابی استفاده نمی‌شود
`clipTransitions` state می‌نویسد ولی هیچ consumer ندارد جز نمایش رنگ آیکون pencil.

## برنامه (Surgical, Deterministic)

### بخش ۱: Preview — اعمال واقعی transition بین scenes

در `ProVideoEditor.tsx` `advanceToNextScene` (خط ۱۵۸۰-۱۶۴۰):

1. **خواندن transition انتخابی** برای scene فعلی:
   ```ts
   const currentSceneId = storyboard[selectedSceneIndex]?.id;
   const t = clipTransitions[currentSceneId] ?? { type: "Crossfade", duration: 0.5 };
   const durMs = t.duration * 1000;
   ```

2. **اضافه‌کردن state جدید برای transition type**:
   ```ts
   const [activeTransition, setActiveTransition] = useState<{type: string; duration: number} | null>(null);
   ```

3. **اعمال transition class داینامیک** روی `<video>` و `<canvas>` (خطوط ۲۲۸۴, ۲۲۹۰, ۲۳۰۶):
   ```tsx
   className={cn(
     "w-full h-full object-cover",
     getTransitionClass(activeTransition, sceneTransition)
   )}
   style={getTransitionStyle(activeTransition)}
   ```

4. **تابع `getTransitionClass`** که هر template را به CSS animation map می‌کند:
   - `Crossfade` → `opacity` transition (موجود)
   - `Cross Blur` → `opacity` + `filter: blur(20px)`
   - `Fade Black` → overlay مشکی fade in/out
   - `Fade White` → overlay سفید fade in/out
   - `Wipe Up/Down/Left/Right` → `clip-path: inset(...)` با animation
   - `Slide Up/Down` → `transform: translateY(...)` 
   - `Zoom In/Out` → `transform: scale(...)`

5. **افزودن overlay layer** برای fade-to-black/white:
   ```tsx
   {sceneTransition && activeTransition?.type === "Fade Black" && (
     <div className="absolute inset-0 z-40 bg-black animate-flash-black" 
          style={{animationDuration: `${activeTransition.duration}s`}} />
   )}
   ```

6. **تعریف keyframes** در `src/index.css` (یا `tailwind.config.ts`):
   - `@keyframes flash-black` (0% opacity:0 → 50% opacity:1 → 100% opacity:0)
   - `@keyframes flash-white` (مشابه با bg-white)
   - `@keyframes wipe-down` (`clip-path: inset(0 0 100% 0)` → `inset(0)`)
   - `@keyframes wipe-up`, `wipe-left`, `wipe-right` (مشابه)
   - `@keyframes slide-up`, `slide-down` (`translateY(100%)` → `0`)
   - `@keyframes zoom-in` (`scale(0.5)` → `1`), `zoom-out` (`scale(1.5)` → `1`)
   - `@keyframes blur-fade` (`filter: blur(20px) opacity(0)` → `blur(0) opacity(1)`)

7. **استفاده از duration انتخابی کاربر** برای `setTimeout` به‌جای ۵۰۰ms ثابت:
   ```ts
   setTimeout(() => { ... }, durMs);
   ```

### بخش ۲: Export — pass per-scene transitions

در `videoStitch.ts`:

1. **افزودن `perClipTransitions?: { type: string; duration: number }[]`** به `StitchOverlayOptions` (هم‌اندیس با clips).

2. **در حلقه‌ی render (خط ۶۴۸-۶۷۵)** به‌جای فقط alpha blend:
   ```ts
   const transition = perClipTransitions?.[clipIndex] ?? { type: "Crossfade", duration: crossfadeDur };
   const t = transition.type;
   const progress = ... ;
   
   switch(t) {
     case "Cross Blur":
       ctx.filter = `blur(${20 * (1-progress)}px)`;
       drawOutgoing();
       ctx.filter = `blur(${20 * progress}px)`;
       drawIncoming();
       ctx.filter = "none";
       break;
     case "Fade Black":
       drawOutgoing(1-progress);
       ctx.fillStyle = "#000";
       ctx.globalAlpha = (progress < 0.5 ? progress*2 : (1-progress)*2);
       ctx.fillRect(0,0,W,H);
       if (progress >= 0.5) drawIncoming(1);
       break;
     case "Fade White":  /* مشابه با #fff */
     case "Wipe Down":
       drawOutgoing(1);
       ctx.save();
       ctx.beginPath();
       ctx.rect(0, 0, W, H * progress);
       ctx.clip();
       drawIncoming(1);
       ctx.restore();
       break;
     case "Wipe Up", "Wipe Left", "Wipe Right":  /* تغییر rect */
     case "Slide Up":
       drawOutgoing(1);
       ctx.save();
       ctx.translate(0, H * (1 - progress));
       drawIncoming(1);
       ctx.restore();
       break;
     case "Slide Down", "Zoom In", "Zoom Out":  /* مشابه */
     default: /* Crossfade — منطق فعلی */
   }
   ```

3. **در `useRenderPipeline`** (یا هرکجا stitcher صدا می‌شود) آرایه‌ی `perClipTransitions` را از `clipTransitions` state بسازد.

### بخش ۳: حذف باگ آیکون pencil
آیکون pencil فقط برای transitions موجود نمایش رنگ متفاوت دارد ولی duration `transitionDuration` global جداست. اطمینان می‌گیرم که `clipTransitions[sceneId]?.duration` به‌جای `transitionDuration` global پاس داده می‌شود.

## فایل‌های تغییرکننده
- `src/components/ad-director/ProVideoEditor.tsx` — خواندن `clipTransitions` در `advanceToNextScene`، state `activeTransition`, اعمال className/style داینامیک، اضافه‌کردن overlay layers برای fade-black/white، pass به stitcher
- `src/index.css` — تعریف `@keyframes` برای wipe-up/down/left/right, slide-up/down, zoom-in/out, flash-black, flash-white, blur-fade + کلاس‌های utility متناظر
- `src/lib/videoStitch.ts` — افزودن `perClipTransitions` به interface، switch روی `transition.type` در حلقه render
- `src/hooks/useRenderPipeline.ts` (یا call site stitcher) — pass آرایه‌ی per-clip transitions

## آنچه دست‌نخورده می‌ماند
- منطق scene generation (Veo / Wan / Sora)
- Audio extraction / muting
- Timeline thumbnails / preview cards
- Subtitle rendering, logo, music
- DB / RLS
- زبان UI: انگلیسی

## نتیجه‌ی مورد انتظار
1. ✅ هر transition انتخابی **در preview واقعاً اجرا می‌شود** (با animation متناظر)
2. ✅ duration slider واقعی است (به‌جای hardcoded 500ms)
3. ✅ هر transition انتخابی **در exported MP4 نیز اجرا می‌شود** (canvas-based)
4. ✅ هر scene می‌تواند transition مستقل داشته باشد (نه global)
5. ✅ تمپلیت‌های Wipe / Slide / Zoom / Blur / Fade-Black / Fade-White همگی به‌طور قطعی کار می‌کنند

