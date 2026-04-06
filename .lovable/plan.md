
هدف: مشکل Vizzy Brain را از ریشه در دو لایه حل می‌کنم: تعامل‌پذیری UI و دسترسی واقعی به مموری‌ها.

مشکل ریشه‌ای که در کد پیدا شد
1. پنل Brain داخل floating portal رندر می‌شود، اما ریشه‌ی آن portal در `src/lib/floatingPortal.ts` با `pointer-events:none` ساخته شده است.  
در `VizzyVoiceChat` این موضوع با `pointerEvents: "auto"` جبران شده، ولی در `src/components/vizzy/VizzyBrainPanel.tsx` این جبران وجود ندارد.  
نتیجه: دکمه‌های Analyze / Close / accordion / edit / delete عملا کلیک‌پذیر نیستند.

2. مموری‌ها از `src/hooks/useVizzyMemory.ts` با فیلتر `company_id` خوانده می‌شوند، اما RLS جدول `vizzy_memory` هنوز عملا بر پایه‌ی `user_id = auth.uid()` است.  
پالیسی ادمین هم در migration فعلی خراب است:
- فایل: `supabase/migrations/20260319050345_b3f8c422-20b5-401c-99f8-dc6bd0d0af45.sql`
- مشکل: `user_roles.user_id` به `profiles.id` join شده، نه `profiles.user_id`  
نتیجه: ادمین هم مموری‌های شرکت را نمی‌بیند، بنابراین پنل خالی نمایش داده می‌شود.

3. UI خطای واقعی را پنهان می‌کند. الان اگر query به خاطر RLS یا company context درست برنگردد، کاربر فقط پیام `No memories yet` می‌بیند و تصور می‌کند داده‌ای وجود ندارد.

نکته مهم
- Realtime برای `vizzy_memory` از قبل فعال شده (`ALTER PUBLICATION supabase_realtime ADD TABLE public.vizzy_memory;`)؛ پس ریشه‌ی مشکل از فعال نبودن realtime نیست.

برنامه اصلاح
1. اصلاح تعامل‌پذیری پنل
- فایل: `src/components/vizzy/VizzyBrainPanel.tsx`
- روی لایه اصلی modal، `pointer-events-auto` اضافه می‌کنم تا کل پنل داخل floating layer قابل کلیک شود.
- دکمه‌های بالا، accordion triggerها، و آیکون‌های edit/delete دوباره فعال می‌شوند.

2. اصلاح دسترسی ریشه‌ای به مموری‌ها
- یک migration جدید برای `vizzy_memory` می‌سازم.
- پالیسی خراب ادمین را حذف می‌کنم.
- پالیسی درست برای ادمین همان شرکت می‌گذارم با این منطق:
  - `company_id = public.get_user_company_id(auth.uid())`
  - `public.has_role(auth.uid(), 'admin')`
- این دسترسی را فقط برای `SELECT / UPDATE / DELETE` می‌گذارم تا ادمین بتواند همه مموری‌های شرکت را ببیند و مدیریت کند.
- پالیسی فعلی “own memory” برای رکوردهای شخصی حفظ می‌شود.

3. اصلاح hook تا خطاها پنهان نشوند
- فایل: `src/hooks/useVizzyMemory.ts`
- خروجی hook را کامل‌تر می‌کنم: `error`, `isCompanyLoading`, `hasCompanyContext`
- اگر company profile ناقص باشد، hook آن را صریح اعلام می‌کند.
- اگر query خطا بدهد، پنل آن را به‌صورت error state نشان می‌دهد، نه empty state.

4. اصلاح stateهای نمایشی پنل
- فایل: `src/components/vizzy/VizzyBrainPanel.tsx`
- سه وضعیت جدا می‌گذارم:
  - Loading
  - Error / Access issue
  - Truly empty
- اگر کاربر دسترسی ادمین نداشته باشد یا company context ناقص باشد، پیام دقیق نشان داده می‌شود.
- اگر واقعا داده‌ای نباشد، فقط آن زمان `No memories yet` نمایش داده می‌شود.

فایل‌های درگیر
- `src/components/vizzy/VizzyBrainPanel.tsx`
- `src/hooks/useVizzyMemory.ts`
- `supabase/migrations/...` (migration جدید اصلاح RLS)

اعتبارسنجی بعد از اجرا
1. کلیک‌پذیر بودن Close / Analyze Now / accordion / edit / delete
2. نمایش مموری‌های موجود شرکت برای ادمین
3. ساخت insight جدید با Analyze Now و نمایش فوری آن
4. ویرایش و حذف مموری‌های company-level توسط ادمین
5. نمایش پیام درست برای حالت‌های:
- no data
- no access
- missing company profile
- query error

نتیجه نهایی
- همه آیکون‌ها و اکشن‌های Brain واقعا کار می‌کنند
- مموری‌ها به‌جای خالی بودن، از دیتابیس شرکت نمایش داده می‌شوند
- خطاهای دسترسی دیگر پشت empty state پنهان نمی‌مانند
- مشکل هم از سمت UI و هم از سمت backend/RLS به‌صورت ریشه‌ای بسته می‌شود
