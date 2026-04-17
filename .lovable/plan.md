

## درخواست کاربر
در timeline editor، کارت دومی که در screenshot نشان داده شده (`52676.jpeg` — یک scene از نوع image) **هیچ thumbnail/preview ندارد** و فقط یک مستطیل سبز خالی با نام فایل است. کاربر می‌خواهد **هیچ کارتی هرگز بدون preview تصویر یا فیلم نباشد**.

## بررسی کد

نیاز به یافتن:
- کامپوننتی که timeline clip cards (نوار پایین با thumbnail کوچک) را render می‌کند
- منطق fallback برای زمانی که `videoUrl` یک `data:image/...` است (image scene)
- چرا کارت اول thumbnail دارد ("The High Cost of Chaos") ولی کارت دوم خالی است

محتمل‌ترین فایل: `src/components/ad-director/TimelineBar.tsx` یا `ProVideoEditor.tsx` — جایی که thumbnail هر clip در video lane ساخته می‌شود.

## فرضیه‌ی اولیه

با توجه به این که کارت اول شامل یک تصویر کوچک سمت چپ و overlay متن است، احتمالاً منطق thumbnail چیزی شبیه این دارد:
```tsx
<video src={clip.videoUrl} /> یا <img src={clip.thumbnailUrl} />
```

و وقتی scene از نوع image است (`videoUrl` شامل `data:image/...` یا یک image url مثل `.jpeg`):
- یا تشخیص داده نمی‌شود
- یا `<video>` element نمی‌تواند image را render کند
- یا `thumbnailUrl` فقط برای video scenes ست شده

## برنامه (Surgical, Additive)

### ۱. تشخیص نوع clip و انتخاب element مناسب
در رندر thumbnail کارت timeline:

```tsx
const isImage = clip.videoUrl?.startsWith("data:image/") 
  || /\.(jpe?g|png|webp|gif)$/i.test(clip.videoUrl ?? "");

{isImage ? (
  <img 
    src={clip.videoUrl} 
    alt={clip.label ?? "scene"}
    className="w-full h-full object-cover"
    loading="lazy"
  />
) : clip.videoUrl ? (
  <video 
    src={clip.videoUrl}
    className="w-full h-full object-cover"
    muted
    playsInline
    preload="metadata"
  />
) : (
  // Last-resort fallback: gradient placeholder + scene number
  <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white/60 text-xs font-semibold">
    Scene {idx + 1}
  </div>
)}
```

### ۲. تضمین هرگز خالی نبودن
سه‌سطحی fallback:
1. **Image scene** → `<img>` با src مستقیم
2. **Video scene** → `<video preload="metadata">` (frame اول render می‌شود)
3. **No url / generating** → placeholder gradient با شماره‌ی scene + spinner در صورت `status: "generating"`

### ۳. هماهنگی با کارت‌های "Generated Scenes" در main flow
بررسی می‌کنم همان منطق در `AdDirectorContent.tsx` (کارت‌های scene بالای timeline) هم اعمال شود — اگر آنجا هم image scene بدون preview است، همین fallback را اضافه می‌کنم.

### ۴. حفاظت از CORS/load failure
روی `<img>` و `<video>` یک `onError` handler می‌گذارم که در صورت fail، به placeholder gradient سوییچ کند:
```tsx
const [failed, setFailed] = useState(false);
{failed ? <PlaceholderCard /> : <img onError={() => setFailed(true)} ... />}
```

## فایل‌های تغییرکننده
- `src/components/ad-director/TimelineBar.tsx` (یا هرکجا thumbnail نوار timeline render می‌شود) — افزودن منطق `isImage` + fallback gradient
- در صورت نیاز: `src/components/ad-director/AdDirectorContent.tsx` برای کارت‌های Generated Scenes

دقیقاً کدام lines در فاز execute بعد از grep روی `videoUrl` و `thumbnail` در TimelineBar مشخص می‌شوند.

## آنچه دست‌نخورده می‌ماند
- منطق scene generation / Veo / Wan / Sora
- audio track seeding (تغییر اخیر)
- Split / transitions / playback
- DB / RLS
- زبان UI: انگلیسی

## نتیجه‌ی مورد انتظار
1. ✅ هر کارت در timeline یک preview قابل مشاهده دارد (image یا video frame)
2. ✅ Image scenes (`.jpeg`, `data:image/...`) به‌جای `<video>` با `<img>` نمایش داده می‌شوند
3. ✅ اگر url خراب باشد یا load fail کند، placeholder gradient با شماره‌ی scene نمایش داده می‌شود
4. ✅ هیچ کارتی هرگز بدون visual representation نمی‌ماند
5. ✅ رفتار consistent بین timeline cards و Generated Scenes cards

