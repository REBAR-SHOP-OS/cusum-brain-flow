

## درخواست کاربر
روی **آخرین کارت** هر clip در timeline (Video lane)، یک آیکون مداد ✏️ نمایش داده شود. با کلیک روی آن، کاربر بین template های **transition** انتخاب کند و transition انتخابی روی ویدئو اعمال شود.

از screenshot معلوم است: روی scene دوم (آخرین کارت) یک دایره‌ی قرمز کشیده شده که نقطه‌ی مورد نظر برای آیکون مداد است.

## بررسی کد فعلی
نیاز به بررسی این فایل‌ها:
- `src/components/ad-director/editor/TimelineBar.tsx` — جایی که Video lane و clip block ها render می‌شوند
- `src/components/ad-director/editor/TransitionsTab.tsx` — موجود است، شامل لیست transition ها (Crossfade, Cross Blur, Wipe, Zoom...)
- `src/components/ad-director/ProVideoEditor.tsx` — state ای که transition per-clip را نگه می‌دارد
- جایی که transition بین کلیپ‌ها روی playback اعمال می‌شود (احتمالاً `transitions: Record<sceneId, string>` در project state)

## برنامه (Surgical, Additive)

### ۱. آیکون مداد روی هر clip (Video lane)
در `TimelineBar.tsx` روی هر video clip block:
- یک دکمه‌ی کوچک ✏️ (`Pencil` از lucide-react) در گوشه‌ی **پایین-راست** clip
- اندازه: 14×14px، نیمه‌شفاف، روی hover کاملاً visible
- موقعیت: `absolute bottom-1 right-1`
- این آیکون نشان می‌دهد transition **بعد از این clip** (به clip بعدی) چیست

### ۲. Popover انتخاب transition
کلیک روی مداد → یک `Popover` باز می‌شود:
- عنوان: `Transition after Scene N`
- گرید کوچک از template ها (همان لیست `TransitionsTab.tsx` ولی فشرده‌تر):
  - دسته‌بندی: Fades & Blurs / Wipes / Motion
  - thumbnail رنگی + اسم زیر هر کدام
  - گزینه‌ی `None` در ابتدا
- Slider برای `duration` (0.1s – 2.0s، پیش‌فرض 0.5s)
- transition فعلی با border رنگی highlight شود

### ۳. State management
- در `ProVideoEditor.tsx` (یا هر hook بالاتر که project state را نگه می‌دارد):
  - state جدید: `clipTransitions: Record<string, { type: string; duration: number }>` (key = sceneId)
  - handler: `setClipTransition(sceneId, type, duration)`
- propagate به `TimelineBar` props: `clipTransitions`, `onClipTransitionChange`

### ۴. اعمال transition روی playback
- اگر قبلاً مکانیزم transition (مثل `transitions` state) برای playback داشتیم → از همان استفاده کنیم
- اگر نداشتیم → روی preview، در لحظه‌ی switch بین clip ها (در `handleVideoEnded`):
  - بسته به `type`، یک CSS class روی `<video>` اعمال شود (مثلاً `animate-fade`, `animate-slide-up`, `animate-zoom-in`) به مدت `duration` ثانیه
  - برای `Crossfade`: یک overlay از frame آخر clip قبلی به‌مدت duration روی clip جدید fade out شود
  - برای `Wipe/Slide/Zoom`: transform/clip-path animation

> این بخش (export pipeline) بدون تغییر می‌ماند مگر اینکه قبلاً transition support داشته باشد. در preview کافی است که visually اعمال شود.

### ۵. آخرین clip
- آخرین clip transition ندارد (چون بعدش clip دیگری نیست)، ولی همان UI آیکون مداد می‌تواند transition **ورودی به این clip** (transition بعد از clip قبلی) را ویرایش کند تا تجربه یکنواخت باشد. یا ساده‌تر: روی آخرین clip آیکون مداد را نمایش ندهیم. **انتخاب می‌کنیم: روی همه‌ی clip ها به‌جز آخرین clip نمایش داده شود** (transition بین این clip و بعدی).

## فایل‌های تغییرکننده
- `src/components/ad-director/editor/TimelineBar.tsx` — افزودن آیکون مداد + Popover روی video clip blocks
- `src/components/ad-director/ProVideoEditor.tsx` — state `clipTransitions` و propagation
- `src/components/ad-director/editor/ClipTransitionPopover.tsx` (جدید، کوچک) — popover با لیست template ها (می‌تواند از `TransitionsTab.tsx` استفاده‌ی مجدد کند)
- منطق playback: اعمال CSS animation روی switch clip ها در preview

## آنچه دست‌نخورده می‌ماند
- `TransitionsTab.tsx` کامل (لیست template ها، logic انتخاب، slider) — re-use می‌شود
- Veo / Wan / Sora generation flow
- DB schema / RLS
- Export pipeline (مگر اینکه قبلاً transition support داشته باشد)
- Audio / Music / Text lanes
- زبان UI: انگلیسی

## نتیجه‌ی مورد انتظار
1. ✅ روی هر clip در Video lane (به‌جز آخرین) یک آیکون مداد ظاهر می‌شود
2. ✅ کلیک روی آن، popover انتخاب transition با template های موجود + slider duration نشان می‌دهد
3. ✅ انتخاب transition بلافاصله روی preview playback اعمال می‌شود
4. ✅ State per-clip ذخیره و در project نگه‌داری می‌شود

