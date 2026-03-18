

## مشکل: "Error marking item" در لیست خرید

### علت اصلی
پالیسی‌های RLS جدول `purchasing_list_items` اشتباه هستند. شرط فعلی:
```sql
WHERE p.id = auth.uid()
```
اما `profiles.id` یک UUID مستقل است و `auth.uid()` برابر `profiles.user_id` است. بنابراین هیچ‌کدام از عملیات INSERT/UPDATE/DELETE/SELECT از RLS عبور نمی‌کند.

### راه‌حل
تمام ۴ پالیسی RLS (select, insert, update, delete) باید اصلاح شوند:

```sql
-- Drop and recreate all 4 policies
DROP POLICY "Users can view purchasing items in their company" ON public.purchasing_list_items;
DROP POLICY "Users can insert purchasing items in their company" ON public.purchasing_list_items;
DROP POLICY "Users can update purchasing items in their company" ON public.purchasing_list_items;
DROP POLICY "Users can delete purchasing items in their company" ON public.purchasing_list_items;

CREATE POLICY "Users can view purchasing items in their company"
ON public.purchasing_list_items FOR SELECT
USING (company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can insert purchasing items in their company"
ON public.purchasing_list_items FOR INSERT
WITH CHECK (company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can update purchasing items in their company"
ON public.purchasing_list_items FOR UPDATE
USING (company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can delete purchasing items in their company"
ON public.purchasing_list_items FOR DELETE
USING (company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()));
```

تغییر کلیدی: `p.id = auth.uid()` → `p.user_id = auth.uid()`

### نتیجه
تمام عملیات (approve، reject، add، delete) بدون خطا کار خواهند کرد.

