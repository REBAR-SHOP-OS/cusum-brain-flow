

# تقویت تنوع تصاویر ایجنت Pixel — سبک‌های متنوع و ضد تکرار

## مشکل
تصاویر تولیدشده شبیه هم هستند چون هر اسلات یک `imageStyle` ثابت دارد و همیشه همان صحنه تکرار می‌شود.

## راه‌حل

### ۱. آرایه سبک‌های متنوع برای هر اسلات
به جای یک `imageStyle` ثابت، هر اسلات آرایه‌ای از ۸-۱۰ سبک مختلف داشته باشد که هنگام تولید، یکی به‌صورت تصادفی انتخاب شود:

**فایل: `supabase/functions/ai-agent/index.ts`**

هر اسلات در `PIXEL_SLOTS` فیلد `imageStyles: string[]` بگیرد (به جای `imageStyle: string`) با سبک‌هایی مثل:
- صحنه واقعی کارگاه (workshop/fabrication shop)
- سایت ساخت‌وساز (active construction site)
- نمای شهری با ساختمان‌های در حال ساخت (urban cityscape)
- نمادهای شهری و پل‌ها (bridges, landmarks, infrastructure)
- نمای هوایی/درون از پروژه بزرگ (aerial view)
- عکس محصول استودیویی (studio product shot)
- کلوزآپ جزئیات فنی (macro/detail shot)
- نمای دراماتیک غروب/طلوع (dramatic lighting)
- صحنه بارگیری و حمل‌ونقل (logistics/delivery)
- نمای مهندسی و نقشه‌کشی (engineering blueprints with product)

### ۲. انتخاب تصادفی + ضد تکرار هوشمند
- هنگام تولید، از لیست فایل‌های اخیر bucket (که الان خوانده می‌شود) سبک‌های استفاده‌شده اخیر را حدس بزنیم
- سبکی انتخاب شود که کمترین شباهت به تصاویر اخیر دارد
- سبک انتخاب‌شده + تایم‌استمپ به prompt تزریق شود

### ۳. تقویت prompt تصویر
به `imagePrompt` دستور صریح‌تری اضافه شود:

```
MANDATORY VISUAL DIVERSITY RULES:
- Use ONE of these visual styles (randomly selected for this generation): [selected style]
- FORBIDDEN: Do not repeat any composition, camera angle, color palette, or scene layout from recent images
- Vary between: workshop realism, urban construction, city landmarks, aerial views, studio product shots, macro details, dramatic lighting, logistics scenes, engineering blueprints
- Each image must feel like it belongs to a completely different photo series
```

### ۴. تقویت prompt سیستم در `marketing.ts`
اضافه کردن قانون تنوع سبک‌ها به بخش IMAGE RULES:

```
- USE DIVERSE VISUAL STYLES — rotate between: realistic workshop scenes, active construction sites, urban cityscapes with buildings under construction, city landmarks & bridges & infrastructure, aerial project views, studio product photography, macro detail shots, dramatic sunrise/sunset lighting, logistics & delivery scenes, engineering blueprints with products. NEVER use the same style twice in a row.
```

## فایل‌های تغییر
1. `supabase/functions/ai-agent/index.ts` — تبدیل `imageStyle` به `imageStyles[]` + انتخاب تصادفی + prompt تقویت‌شده
2. `supabase/functions/_shared/agents/marketing.ts` — اضافه کردن قانون تنوع سبک

