
## مشکل
در بخش "Recent projects / Your Previous Videos" فقط یک کارت قدیمی نشان داده می‌شود. کاربر می‌خواهد **هر پروژه‌ای که ساخته می‌شود** (چه draft، چه completed، چه در حال generation) در این لیست ظاهر شود.

## بررسی لازم
باید چند فایل را چک کنم تا ریشه را پیدا کنم:
1. `VideoHistory.tsx` — چطور لیست را می‌خواند
2. `useAdProjectHistory.ts` — کوئری از DB و فیلترها
3. `AdDirectorContent.tsx` و `backgroundAdDirectorService.ts` — کجا `saveProject` صدا می‌شود

## فرضیه‌های احتمالی (نیاز به verify)
1. **Query محدود است** — مثلاً فقط پروژه‌های با `status='completed'` یا فقط با `final_video_url != null` نشان داده می‌شوند، پس draftهای جدید/ناقص فیلتر می‌شوند.
2. **saveProject فقط یک‌بار صدا می‌شود** — در ابتدای generation با initial clips. اگر کاربر قبل از کلیک "Create video" پروژه را آغاز نکند، رکوردی ساخته نمی‌شود.
3. **Realtime subscription نیست** — لیست فقط در mount کوئری می‌گیرد، پس پروژه‌های جدیدی که در همین session ساخته می‌شوند تا refresh دیده نمی‌شوند.
4. **کوئری limit دارد** (مثلاً `.limit(1)` یا `.limit(5)`) که باعث می‌شود فقط آخرین یک پروژه نمایش داده شود.

## برنامه (Surgical)

### گام ۱ — بررسی فایل‌ها
خواندن `VideoHistory.tsx`، `useAdProjectHistory.ts`، و بخش‌های مرتبط `AdDirectorContent.tsx` تا بفهمم دقیقاً کجا فیلتر/limit اعمال می‌شود.

### گام ۲ — Fix احتمالی (بعد از تأیید)
- **در `useAdProjectHistory.ts`**: حذف هر فیلتری که draftها یا پروژه‌های in-progress را پنهان می‌کند. کوئری باید `select('*').order('updated_at', { ascending: false })` باشد بدون فیلتر روی status.
- **در `backgroundAdDirectorService.ts`**: اطمینان از اینکه `saveProject` همان لحظه‌ای که کاربر "Create video" می‌زند (یا حتی "Analyze") صدا زده می‌شود تا رکورد فوراً در DB ثبت شود (پیش از این در ابتدای pipeline اضافه شد).
- **افزودن Realtime subscription** در `useAdProjectHistory.ts` با channel یکتا (طبق memory `subscription-standards`) تا هر insert/update روی `ad_projects` فوراً در لیست reflect شود — بدون نیاز به refresh.
- **حذف هر `limit()`** که لیست را به n مورد محدود می‌کند (یا تبدیل به limit بزرگتر مثل 50).

### آنچه تغییر نمی‌کند
- Schema جدول `ad_projects` — بدون تغییر
- UI کارت `VideoHistory` و دکمه‌های Resume/Delete — بدون تغییر  
- منطق sanitization `blob:` URLs — بدون تغییر

### نتیجه
هر پروژه‌ای که شروع به ساخت می‌شود (حتی نیمه‌تمام، failed، یا draft) **بلافاصله** در "Your Previous Videos" ظاهر می‌شود و با هر تغییر state (تکمیل scene، export نهایی، retry) **realtime** آپدیت می‌شود.
