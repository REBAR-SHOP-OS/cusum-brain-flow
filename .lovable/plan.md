
# به‌روزرسانی تایم‌لاین‌های Pipeline -- مطابقت دقیق با Odoo

## مشکل
تایم‌لاین‌ها (Chatter, Notes, Activities) وقتی خالی هستند، پیام و ظاهر مناسبی ندارند و با Odoo مطابقت ندارند.

## تغییرات (فقط UI -- بدون تغییر منطق یا دیتابیس)

### 1. `src/components/pipeline/OdooChatter.tsx`
- Empty state: متن را تغییر بده به "No activities yet. Log a note or schedule an activity above." دقیقا مشابه Odoo (در حال حاضر همین متن هست، ولی استایل بهتر شود)
- آیکون خالی بودن اضافه شود (مثل Odoo: یک آیکون clipboard/notepad کم‌رنگ بالای متن)
- فاصله‌گذاری و padding empty state مطابق Odoo (padding بیشتر، مرکز صفحه)
- رنگ متن: خاکستری ملایم‌تر

### 2. `src/components/pipeline/ScheduledActivities.tsx`
- Empty state: متن "No scheduled activities yet." را تغییر بده به "No activities yet. Schedule an activity to get started."
- همان آیکون خالی مشابه Odoo اضافه شود
- استایل button "Schedule Activity" کمی compact‌تر و Odoo-like (rounded-sm, font-size 13px)

### 3. `src/components/pipeline/LeadDetailDrawer.tsx`
- Notes tab: وقتی خالی است، پیام "No notes yet." را بهبود بده: آیکون + متن مرکزی مشابه Odoo
- Tab underline ضخامت 2px (مطابق Odoo)

### 4. `src/components/pipeline/LeadTimeline.tsx`
- Empty state: متن و آیکون مشابه Odoo اضافه شود
- این کامپوننت در Chatter tab استفاده نمی‌شود (OdooChatter جایگزین آن شده) ولی اگر جای دیگری استفاده شود باید هماهنگ باشد

## جزئیات فنی

### Empty State Pattern (یکسان در همه تایم‌لاین‌ها):
```text
+----------------------------------+
|                                  |
|        [clipboard icon]          |
|                                  |
|   No activities yet. Log a note  |
|   or schedule an activity above. |
|                                  |
+----------------------------------+
```
- آیکون: `FileText` یا `MessageSquare` از lucide، سایز `w-10 h-10`، رنگ `text-muted-foreground/30`
- متن: `text-[13px] text-muted-foreground`، `text-center`
- Container: `py-12` برای فاصله عمودی مناسب

### فایل‌های تغییر یافته:
- `src/components/pipeline/OdooChatter.tsx` -- empty state styling
- `src/components/pipeline/ScheduledActivities.tsx` -- empty state styling
- `src/components/pipeline/LeadDetailDrawer.tsx` -- Notes empty state + tab underline
- `src/components/pipeline/LeadTimeline.tsx` -- empty state styling

### بدون تغییر:
- هیچ تغییری در دیتابیس، RLS، منطق، API، یا سایر بخش‌های اپلیکیشن
