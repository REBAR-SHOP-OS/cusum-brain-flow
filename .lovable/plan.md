

# حذف دسترسی عمومی و فعال‌سازی سیستم invite-only

## هدف
- دکمه‌های Google و Apple از صفحه Login حذف شوند
- لینک "Sign up" از صفحه Login حذف شود
- صفحه Signup عمومی غیرفعال شود
- ثبت‌نام فقط با لینک دعوت‌نامه (invite token) ممکن باشد

## تغییرات

### 1. فایل: `src/pages/Login.tsx`
- حذف دکمه "Continue with Google" و handler مربوطه
- حذف دکمه "Continue with Apple" و handler مربوطه
- حذف separator "or"
- حذف لینک "Sign up" از footer
- حذف import `lovable`

### 2. فایل: `src/pages/Signup.tsx` → تبدیل به Invite-Only
- صفحه Signup فقط با پارامتر `?token=...` در URL کار کند
- در mount، token از URL خوانده شود و با edge function اعتبارسنجی شود
- اگر token معتبر نباشد → پیام خطا و redirect به login
- اگر معتبر باشد → فرم ثبت‌نام نمایش داده شود (فقط email/password، بدون Google/Apple)
- پس از ثبت‌نام موفق، token مصرف‌شده علامت‌گذاری شود

### 3. Migration: جدول `invite_tokens`
```sql
CREATE TABLE public.invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  email text,
  company_id uuid REFERENCES public.companies(id),
  role text DEFAULT 'user',
  used_at timestamptz,
  expires_at timestamptz DEFAULT now() + interval '7 days',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;

-- Admins can manage invites for their company
CREATE POLICY "Admins manage invites"
  ON public.invite_tokens FOR ALL TO authenticated
  USING (company_id = get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'));

-- Public can read valid tokens (for signup validation)
CREATE POLICY "Validate token"
  ON public.invite_tokens FOR SELECT TO anon
  USING (used_at IS NULL AND expires_at > now());
```

### 4. Edge Function: `validate-invite`
- POST با `{ token }` → بررسی وجود و اعتبار token
- اگر معتبر: برگرداندن `{ valid: true, email, company_id, role }`
- اگر نامعتبر: `{ valid: false }`

### 5. Edge Function: `consume-invite`
- POST با `{ token, user_id }` → token را مصرف‌شده کند (`used_at = now()`)
- نقش کاربر و company_id را تنظیم کند

### 6. فایل: `src/App.tsx`
- Route `/signup` بدون تغییر باقی بماند (صفحه خودش token را چک می‌کند)

## نتیجه
- صفحه Login: فقط email/password
- ثبت‌نام عمومی غیرممکن
- ثبت‌نام فقط با لینک دعوت (مثلاً `https://app.com/signup?token=abc123`)
- ادمین‌ها می‌توانند لینک دعوت تولید کنند

