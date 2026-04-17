

## ریشه‌ی مشکل — تأیید‌شده با مستندات رسمی Alibaba

طبق [مستندات رسمی Wan](https://www.alibabacloud.com/help/en/model-studio/text-to-video-guide/):

| مدل | خروجی |
|---|---|
| **wan2.6-t2v** (مدل فعلی ما) | **Video with audio** + audio-video synchronization (auto-dubbing) |
| **wan2.6-i2v** (مدل فعلی ما) | **Video with audio** + auto-dubbing |
| wan2.2-t2v-plus | **Silent video** |
| wan2.1-t2v-plus / turbo | **Silent video** |

در `supabase/functions/generate-video/index.ts` خط 208 و 241، ما از `wan2.6-t2v` و `wan2.6-i2v` استفاده می‌کنیم. این مدل‌ها **به‌صورت پیش‌فرض و اجباری**:
1. متن prompt را به صورت **dubbing/narration** به ویدیو می‌چسبانند
2. اگر prompt طولانی باشد ولی duration کوتاه (5-7 ثانیه)، Wan **هم صدا و هم تصویر را فشرده می‌کند** تا داخل duration جا بگیرد → افکت "chipmunk" روی صدا و حرکت سریع و غیرطبیعی روی تصویر

علاوه بر این، طبق سند رسمی، duration باید integer در بازه `[2,15]` باشد ولی **مقادیر توصیه‌شده 5/10/15 هستند**. در کد ما هر integer دلخواه (مثلاً 7 یا 8) پاس می‌شود که می‌تواند باعث rounding داخلی شود.

## برنامه‌ی اصلاحی (یک فایل، سطحی)

### فایل: `supabase/functions/generate-video/index.ts`

**تغییر A — حذف instruction های صوتی از prompt قبل از ارسال به Wan**

در توابع `wanGenerate` (خط 184) و `wanI2vGenerate` (خط 234)، یک sanitizer اضافه کنیم که از prompt حذف کند:
- هرگونه دستور `"speaks: ..."`, `"says: ..."`, `"voiceover:"`, `"narration:"`, `"dialogue:"`, متن داخل گیومه برای dubbing
- segment.text کامل (اگر در prompt تزریق شده)

این اولین لایه‌ی دفاع است: حتی اگر Wan auto-dub کند، چیزی برای خواندن نخواهد داشت.

**تغییر B — تقویت negative_prompt برای سرکوب dubbing/narration**

در هر دو تابع `wanGenerate` و `wanI2vGenerate`، negative prompt پایه را گسترش دهیم:
```ts
const baseNegative = "spoken dialogue, voiceover, narration, talking, lip-sync, dubbing, fast-motion, time-lapse, sped-up, chipmunk voice";
params.negative_prompt = negativePrompt 
  ? `${negativePrompt}, ${baseNegative}` 
  : baseNegative;
```

**تغییر C — Snap duration به مقادیر امن Wan**

مقدار `wanDuration` را به نزدیک‌ترین `[5, 10, 15]` snap کنیم تا Wan داخلی re-time نکند:
```ts
const snapToWanDuration = (d: number): number => {
  if (d <= 7) return 5;
  if (d <= 12) return 10;
  return 15;
};
const wanDuration = snapToWanDuration(Math.max(2, Math.min(15, duration)));
```

این سه تغییر روی هم:
1. ✅ Wan دیگر متن narration نمی‌خواند (sanitize + negative)
2. ✅ Wan دیگر ویدیو را compress نمی‌کند (duration snap)
3. ✅ negative prompt جلوی fast-motion را می‌گیرد

### آنچه دست‌نخورده می‌ماند
- مدل پیش‌فرض `wan2.6-t2v` / `wan2.6-i2v` — بدون تغییر (تا کیفیت تصویر و CHARACTER LOCK حفظ شود)
- منطق i2v vs t2v — بدون تغییر
- stitching, editor, UI — بدون تغییر
- DB / RLS — بدون تغییر

## نتیجه پس از اصلاح
- ویدیوهای scene clip با سرعت طبیعی پخش می‌شوند (نه صدا و نه تصویر سریع نخواهند بود)
- اگر کاربر بخواهد voiceover داشته باشد، از tab **Voiceover** در editor خودش با ElevenLabs اضافه می‌کند

