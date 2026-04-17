

## ریشه‌ی مشکل

با اینکه auto-seed لوگو از ProVideoEditor حذف شد، لوگو هنوز در سه نقطه‌ی دیگر **اتوماتیک** روی ویدیو می‌نشیند:

| محل | فایل/خط | چه می‌کند |
|---|---|---|
| Stitched preview (auto-assemble) | `AdDirectorContent.tsx` خط 153 | `logo: { enabled: !!currentBrand.logoUrl }` → لوگو روی preview نهایی burn می‌شود |
| Background pipeline stitch | `backgroundAdDirectorService.ts` خط 975 | همان منطق در سرویس پس‌زمینه |
| End card | هر دو فایل بالا (`endCard.logoUrl: brand.logoUrl`) | لوگو روی end card رندر می‌شود |
| Scene thumbnail watermark | `SceneCard.tsx` خط 233-237 | `<img>` لوگو روی هر scene card |

**نتیجه:** لوگو در preview، scene thumbnails و end card حتی بدون درخواست کاربر ظاهر می‌شود — دقیقاً همان شکایت تصویر آپلود شده.

## انتظار کاربر
لوگو **هرگز اتوماتیک** اضافه نشود. فقط وقتی کاربر در tab **Brand Kit** خودش می‌خواهد، اضافه شود (و قابل حذف باشد).

---

## برنامه‌ی اصلاحی (سه فایل، سطحی)

### فایل ۱: `src/components/ad-director/AdDirectorContent.tsx` (خط 152-159)
در فراخوانی `stitchClips`:
- `logo.enabled` → `false` (همیشه)
- `endCard.logoUrl` → `null` (همیشه)

### فایل ۲: `src/lib/backgroundAdDirectorService.ts` (خط 974-980)
دقیقاً همان تغییرات فایل ۱:
- `logo.enabled` → `false`
- `endCard.logoUrl` → `null`

### فایل ۳: `src/components/ad-director/SceneCard.tsx` (خط 233-237)
حذف کامل بلاک `<img>` watermark لوگو روی thumbnail. (prop `logoUrl` بدون استفاده باقی می‌ماند که اشکال ندارد.)

### آنچه دست‌نخورده می‌ماند
- خود `LogoTab` و brand kit storage — کاربر همچنان می‌تواند لوگو آپلود کند
- توابع `applyLogoToImage`, `applyLogoWatermark`, و منطق logo overlay در ProVideoEditor — کاربر می‌تواند **دستی** از tab مربوطه اضافه کند
- end card متن (`brandName`, `tagline`, `website`) — حفظ می‌شود، فقط لوگو حذف می‌شود
- منطق stitching, generate, regenerate, character lock — هیچ تغییری
- DB / RLS — هیچ تغییری

## نتیجه پس از اصلاح
1. ✅ Preview نهایی **بدون لوگو** نمایش داده می‌شود
2. ✅ Scene thumbnails **بدون watermark لوگو**
3. ✅ End card **بدون لوگو** (فقط متن brand)
4. ✅ کاربر می‌تواند هر زمان از tab **Brand Kit** در editor، لوگو را به دلخواه اضافه/حذف کند

