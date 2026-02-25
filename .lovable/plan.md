

## حل مشکل نمایش متن غیر انگلیسی در Inbox

### مشکل
یک DB trigger روی جدول `notifications` وجود دارد که هنگام INSERT، فانکشن `translate-notification` را فراخوانی می‌کند. این فانکشن فیلدهای `title` و `description` را با ترجمه فارسی **بازنویسی** می‌کند. چون Inbox مستقیماً از `item.title` و `item.description` استفاده می‌کند، متن فارسی نمایش داده می‌شود.

### راه‌حل
ترجمه را در فیلدهای جداگانه ذخیره کنیم و Inbox همیشه نسخه انگلیسی را نشان دهد، در حالی که toast/browser notifications از نسخه ترجمه‌شده استفاده کنند.

### تغییرات

**1. Migration: اضافه کردن ستون‌های ترجمه**
- اضافه کردن `title_local` و `description_local` به جدول `notifications`
- این ستون‌ها ترجمه را نگه می‌دارند بدون اینکه متن اصلی انگلیسی تغییر کند

**2. `supabase/functions/translate-notification/index.ts`**
- به جای بازنویسی `title` و `description`، ترجمه را در `title_local` و `description_local` ذخیره کند
- متن اصلی انگلیسی دست‌نخورده باقی بماند

**3. `src/components/panels/InboxPanel.tsx`** (بدون تغییر)
- چون `title` و `description` همیشه انگلیسی باقی می‌مانند، نیازی به تغییر UI نیست

**4. `src/hooks/useNotifications.ts`**
- Toast notifications از `title_local` (در صورت وجود) استفاده کنند تا کاربر در toast پیام ترجمه‌شده ببیند

**5. `src/lib/browserNotification.ts`** (بدون تغییر اساسی)
- Browser notifications نیز می‌توانند از `title_local` استفاده کنند

### جزئیات فنی

| فایل | تغییر |
|------|-------|
| Migration SQL | `ALTER TABLE notifications ADD COLUMN title_local TEXT, ADD COLUMN description_local TEXT` |
| `translate-notification/index.ts` خط 66-69 | `update({ title_local, description_local })` به جای `update({ title, description })` |
| `useNotifications.ts` خط 151-165 | Toast از `title_local \|\| title` استفاده کند |

### نتیجه
- Inbox همیشه متن انگلیسی نمایش می‌دهد (از `title`/`description`)
- Toast و browser notifications همچنان می‌توانند ترجمه نشان دهند
- داده‌های موجود فارسی در `title` باقی می‌مانند — برای رفع آنها یک UPDATE اجرا می‌شود تا ردیف‌های فعلی که فارسی شده‌اند اصلاح شوند (اگر نسخه اصلی انگلیسی قابل بازیابی نباشد، باید دستی بررسی شوند)

