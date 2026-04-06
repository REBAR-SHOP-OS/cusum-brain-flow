
هدف نهایی: خطای Publish را ریشه‌ای حل کنم، نه فقط Duplicate check را شل‌تر کنم.

آنچه دقیقاً خراب است:
1. مشکل اصلی از خود Duplicate guard نیست؛ از تداخل دو لایه publish است.
2. در `src/components/social/PostReviewPanel.tsx` دکمه `Publish Now` خودش برای هر page/platform یک combo می‌سازد، برای combo اول روی همان post اصلی publish می‌زند، و برای بقیه clone می‌سازد.
3. اما در `supabase/functions/social-publish/index.ts` خود backend دوباره `page_name` را از خود رکورد DB می‌خواند و روی همه pageهای آن row publish می‌کند:
   - الان کد این است: `const dbPageName = postRecord?.page_name || page_name || ""`
   - یعنی اگر row اصلی در DB هنوز 5 page داشته باشد، حتی اگر UI فقط یک page فرستاده باشد، backend باز هم هر 5 page را publish می‌کند.
4. بعد از اینکه همان row اصلی روی همه pageها publish شد، cloneهای تک-page که UI بلافاصله می‌سازد واقعاً duplicate می‌شوند و با 409 block می‌شوند.
5. شواهد همین را نشان می‌دهد:
   - لاگ backend چند بار پشت‌سرهم همان published post را به‌عنوان duplicate نشان می‌دهد.
   - در DB، post منتشرشده هنوز `page_name` چندتایی دارد.
   - cloneهای جدید هرکدام `page_name` تک‌صفحه‌ای دارند و draft مانده‌اند.

نتیجه: ریشه مشکل این است که manual publish هم در frontend fan-out می‌کند، هم در backend fan-out می‌شود.

برنامه اصلاح:
1. اصلاح backend در `supabase/functions/social-publish/index.ts`
   - `page_name` ارسالی از request را برای manual publish در اولویت قرار می‌دهم.
   - منطق را به این شکل می‌برم:
     - اگر `force_publish=true` و `page_name` آمده، فقط همان page publish شود.
     - فقط وقتی `page_name` نیامده باشد، از `postRecord.page_name` استفاده شود.
   - این تغییر باعث می‌شود backend در publish دستی دیگر بی‌اجازه روی همه pageهای DB نرود.

2. اصلاح orchestration در `src/components/social/PostReviewPanel.tsx`
   - قبل از publish کردن combo اول، row اصلی را به همان `platform` و همان `single page_name` combo اول sync می‌کنم.
   - برای comboهای بعدی همچنان clone ساخته می‌شود، ولی هر row دقیقاً فقط یک page خواهد داشت.
   - یعنی هر row = یک publish target.
   - این ساختار deterministic است و جلوی publish دوباره روی pageهای دیگر را می‌گیرد.

3. سخت‌کردن رفتار manual publish
   - در `social-publish` اگر `force_publish=true` باشد، duplicate guard فقط برای publish دستی bypass بماند و صرفاً cron/auto publish تحت guard بماند.
   - علاوه بر این، لاگ واضح برای `force_publish` و `resolved page list` اضافه می‌شود تا اگر دوباره mismatch رخ داد فوراً معلوم شود.

4. حفظ رفتار cron
   - `supabase/functions/social-cron-publish/index.ts` را دست نمی‌زنم مگر برای هم‌راستا کردن logها.
   - cron باید همچنان duplicate واقعی را block کند، چون آنجا publish دستی admin نیست.

5. اعتبارسنجی بعد از پیاده‌سازی
   - تست publish دستی با 1 page
   - تست publish دستی با چند page روی Instagram/Facebook
   - بررسی اینکه row اصلی فقط همان page انتخابی را publish کند
   - بررسی اینکه cloneها دیگر 409 Duplicate نگیرند
   - بررسی اینکه cron هنوز duplicate واقعی را block کند

فایل‌هایی که باید تغییر کنند:
- `supabase/functions/social-publish/index.ts`
- `src/components/social/PostReviewPanel.tsx`

نکته فنی مهم:
- این یک bug معماری flow است، نه صرفاً bug شرط duplicate.
- تا وقتی backend از `postRecord.page_name` جلوتر از `request.page_name` استفاده کند، هر fix سطحی روی duplicate فقط symptom را جابه‌جا می‌کند، نه علت را.
- هیچ تغییر دیتابیسی لازم نیست.

خروجی مورد انتظار بعد از این اصلاح:
- `Publish Now` برای هر page فقط یک‌بار publish می‌کند
- row اصلی دیگر ناخواسته روی همه pageها publish نمی‌شود
- cloneهای بعدی duplicate کاذب نمی‌خورند
- 409 فقط برای duplicate واقعی در مسیر خودکار باقی می‌ماند
