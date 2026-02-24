

## ارسال PDF کوتیشن به ایمیل مشتری و ایجاد تسک فالوآپ از ساپورت چت

### مشکل فعلی
وقتی مشتری در ساپورت چت سایت rebar.shop درخواست قیمت می‌کند:
- ابزار `submit_barlist_for_quote` فقط یک رکورد در `quote_requests` ذخیره می‌کند و پیام "Quote is being prepared and will be emailed" را برمی‌گرداند، اما **هیچ ایمیلی ارسال نمی‌شود**
- تسک فالوآپ ایجاد می‌شود ولی **کوتیشن PDF نمی‌سازد و ایمیل نمی‌زند**
- ابزار `generate_quotation` در `website-agent` هم HTML تولید می‌کند ولی ایمیل نمی‌فرستد

### راه‌حل

دو تغییر اصلی در فایل `supabase/functions/support-chat/index.ts`:

#### 1. اضافه کردن ابزار جدید `generate_and_email_quote`
یک ابزار جدید به `WIDGET_TOOLS` اضافه می‌شود که:
- اطلاعات مشتری و آیتم‌های قیمت را دریافت می‌کند
- HTML کوتیشن برندشده (مشابه الگوی موجود در `website-agent`) تولید می‌کند
- از طریق `gmail-send` edge function ایمیل با HTML کوتیشن را به مشتری ارسال می‌کند
- یک تسک فالوآپ برای `sourabh@rebar.shop` ایجاد می‌کند
- نوتیفیکیشن به Saurabh ارسال می‌کند

#### 2. به‌روزرسانی `submit_barlist_for_quote` 
تابع موجود نیز بعد از ذخیره quote request، HTML کوتیشن تولید و ایمیل ارسال می‌کند.

### جزئیات فنی

**فایل: `supabase/functions/support-chat/index.ts`**

| تغییر | شرح |
|---|---|
| ابزار جدید `generate_and_email_quote` در `WIDGET_TOOLS` | پارامترها: `customer_name`, `customer_email`, `project_name`, `items[]` (description, quantity, unit_price), `notes` |
| تابع `sendQuoteEmail()` | HTML کوتیشن می‌سازد، سپس از `gmail-send` برای ارسال ایمیل استفاده می‌کند (با service role key) |
| تابع `createFollowUpTask()` | تسک با `assigned_to: SAURABH_PROFILE_ID` و نوتیفیکیشن ایجاد می‌کند |
| به‌روزرسانی `executeWidgetTool` | هندلر جدید برای `generate_and_email_quote` و به‌روزرسانی `submit_barlist_for_quote` |

```text
جریان کار:

مشتری در چت درخواست قیمت می‌دهد
  |
  v
AI اطلاعات مشتری و آیتم‌ها را جمع می‌کند
  |
  v
ابزار generate_and_email_quote فراخوانی می‌شود
  |
  +-- quote_requests در DB ذخیره می‌شود
  |
  +-- HTML کوتیشن برندشده تولید می‌شود
  |
  +-- ایمیل با کوتیشن HTML از طریق gmail-send ارسال می‌شود
  |
  +-- تسک فالوآپ برای sourabh@rebar.shop ایجاد می‌شود
  |
  +-- نوتیفیکیشن به Saurabh ارسال می‌شود
  |
  v
AI به مشتری تایید ارسال کوتیشن را اعلام می‌کند
```

**روش ارسال ایمیل:**
- از همان Gmail OAuth flow موجود استفاده می‌شود (shared `GMAIL_REFRESH_TOKEN`)
- مستقیماً Gmail API فراخوانی می‌شود (بدون نیاز به auth کاربر چون service-level است)
- ایمیل از آدرس `sales@rebar.shop` ارسال می‌شود

**فرمت HTML کوتیشن:**
- همان الگوی برندشده موجود در `website-agent` (لوگوی Rebar.Shop, آدرس, شماره تماس)
- جدول آیتم‌ها با قیمت واحد و مبلغ کل
- محاسبه HST 13% و جمع نهایی
- تاریخ اعتبار 30 روزه

### چه چیزهایی تغییر نمی‌کند
- `website-agent` بدون تغییر باقی می‌ماند
- `gmail-send` بدون تغییر باقی می‌ماند
- دیتابیس و اسکیما بدون تغییر
- ویجت چت (frontend) بدون تغییر
- سایر کامپوننت‌ها و صفحات بدون تغییر

