

## Plan: Lock AI Prompt Output to Rebar.Shop Advertising Content

### Problem
الان AI پرامت‌هایی تولید می‌کند که شرکت را به صورت placeholder ("Company") ذکر می‌کند و محتوا همیشه تبلیغاتی نیست. کاربر می‌خواهد:
1. **همیشه** محتوای تولیدشده تبلیغاتی (ad/commercial) باشد
2. شرکت **همیشه rebar.shop** باشد — نه "Company"، نه placeholder

### Root Cause
در `ChatPromptBar.tsx` تابع `buildContextString()` فقط chipهای انتخاب‌شده (Style/Product/Duration/Ratio/Engine) را به edge function می‌فرستد. هیچ brand/company context و هیچ "advertising" intent در input نیست. edge function `ad-director-ai` با action `write-script` یک system prompt عمومی دارد که نمی‌داند برای کدام شرکت تبلیغ بنویسد، پس از "Company" به عنوان جایگزین استفاده می‌کند.

### Fix (Surgical, 1 file)

**`src/components/ad-director/ChatPromptBar.tsx`** — فقط `buildContextString()`:
- اضافه کردن brand context ثابت در ابتدای string ارسالی به AI:
  ```
  BRAND: rebar.shop (industrial rebar fabrication & supply company)
  WEBSITE: https://rebar.shop
  CONTENT TYPE: Advertising / commercial video ad
  GOAL: Promote rebar.shop products and brand
  ```
- بقیه context (chips) بعد از این بلاک می‌آید
- این تغییر باعث می‌شود AI همیشه بداند:
  - برند = rebar.shop (نه "Company")
  - نوع محتوا = تبلیغاتی
  - هدف = promotion of rebar.shop

### What Stays the Same
- Edge function `ad-director-ai` — بدون تغییر
- Dialog UI، chips، Regenerate، Use this prompt — بدون تغییر
- بقیه handlerها — بدون تغییر
- textarea اصلی و Create video — بدون تغییر

### Result
کلیک روی **AI Prompt** → پرامت تولیدشده **همیشه** تبلیغاتی است، **همیشه** نام rebar.shop را به جای "Company" به کار می‌برد، و محصولات/استایل انتخابی کاربر را در دل یک ad script واقعی برای rebar.shop می‌گنجاند.

