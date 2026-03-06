

# الزام سبک واقع‌گرایانه (Photorealistic) برای تمام تصاویر Pixel

## مشکل
برخی سبک‌ها در `VISUAL_STYLES_POOL` ممکن است تصاویر تخیلی یا غیرواقعی تولید کنند (مثل "Underwater/foundation level perspective" یا استودیویی). نیاز است تمام سبک‌ها به‌صورت الزامی واقع‌گرایانه باشند.

## تغییرات

### ۱. فایل: `supabase/functions/ai-agent/index.ts`

**VISUAL_STYLES_POOL** — هر سبک عبارت `PHOTOREALISTIC, real-world photography, NOT CGI/fantasy/illustration` را دریافت کند و سبک‌های غیرواقعی اصلاح شوند:
- "Studio product photography" → "Real product photography in actual warehouse/shop environment"
- "Underwater/foundation level perspective" → "Ground-level real photography inside deep foundation"
- هر آیتم پیشوند `PHOTOREALISTIC real-world photography —` بگیرد

**imagePrompt** (خط ۶۳۰-۶۴۱) — اضافه کردن دستور صریح:
```
MANDATORY REALISM RULE: ALL images MUST be photorealistic — real-world photography style. 
ABSOLUTELY FORBIDDEN: CGI, 3D renders, illustrations, cartoons, fantasy, surreal, abstract art.
Every image must look like it was taken by a professional photographer with a real camera on a real location.
```

### ۲. فایل: `supabase/functions/_shared/agents/marketing.ts`

بخش `IMAGE RULES` (خط ۴۹) — تقویت قانون واقع‌گرایی:
```
- ALL images MUST be PHOTOREALISTIC — real-world professional photography style ONLY. 
  ABSOLUTELY FORBIDDEN: CGI, 3D renders, digital illustrations, cartoons, fantasy, surreal, abstract, AI-looking art.
  Every image must look like a real photo taken with a professional camera at a real construction site, workshop, or urban location.
```

## فایل‌های تغییر
1. `supabase/functions/ai-agent/index.ts` — تقویت VISUAL_STYLES_POOL + imagePrompt
2. `supabase/functions/_shared/agents/marketing.ts` — تقویت IMAGE RULES

