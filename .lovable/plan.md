

# گزارش وضعیت پابلیش سیستم Social Media Manager

## وضعیت کلی هفته 30 مارس تا 5 آوریل

```text
┌─────────────┬────────────┐
│ Status      │ Count      │
├─────────────┼────────────┤
│ Published   │ 16         │
│ Scheduled   │ 21         │
│ Failed      │ 2          │
│ Draft       │ 3          │
│ TOTAL       │ 42         │
└─────────────┴────────────┘
```

## وضعیت به تفکیک پلتفرم

```text
Platform     Published  Scheduled  Failed
─────────────────────────────────────────
Facebook     6          7          0
Instagram    4          7          2
LinkedIn     6          7          0
Unassigned   0          0          0 (3 draft)
```

## ✅ چه چیزی درست کار می‌کند

1. **Facebook**: تمام 6 پست تایید شده با موفقیت در تمام 5 صفحه منتشر شدند. خطایی وجود ندارد.
2. **LinkedIn**: تمام 6 پست با موفقیت منتشر شدند.
3. **Atomic Locking**: قفل‌ها درست کار می‌کنند — هیچ پست تکراری وجود ندارد.
4. **Cron Job**: هر 5 دقیقه اجرا می‌شود و پست‌های تایید شده (`neel_approved=true`) را پیدا و منتشر می‌کند.
5. **6 پست آینده امروز** (31 مارس ساعت 16:30 و 18:30 UTC) آماده پابلیش هستند — `neel_approved=true` و `qa_status=approved`.

## ❌ دو مشکل شناسایی شده

### مشکل 1: Instagram Failed — "owner token not found"
**پست**: `Precision Power on the Job Site` (30 مارس 21:00)
**خطا**: `instagram not connected for post owner (b0c1c3d5). Owner-only token policy — no team fallback.`

**علت**: تمام پست‌ها توسط `zahra@rebar.shop` ساخته شده‌اند. اما zahra هیچ توکن `instagram` ندارد — فقط توکن‌های `facebook_page_*` دارد (بدون pages/IG data). توکن اصلی Instagram متعلق به `radin@rebar.shop` (Sebastian Ernesto) است.

**تاثیر**: سیاست Owner-Only که اخیراً اعمال شد، باعث شد Instagram برای پست‌های zahra fail شود، چون فقط توکن صاحب پست مجاز است.

### مشکل 2: Instagram Failed — "media processing timed out"
**پست**: `Build Beyond Today.` (31 مارس 12:00)
**خطا**: `Instagram media processing timed out after 20s` برای تمام 5 صفحه

**علت**: تایم‌اوت 20 ثانیه برای عکس‌ها کافی نیست — ممکن است عکس بزرگ باشد یا سرور IG کند پاسخ دهد.

## 🔑 مشکل اصلی: Token Ownership

```text
User                    FB Token    IG Token    Posts Created
──────────────────────────────────────────────────────────────
zahra@rebar.shop        ✅ (pages)   ❌          42 (ALL posts)
radin@rebar.shop        ✅ (full)    ✅ (full)    0
sattar@rebar.shop       ✅ (full)    ✅ (full)    0
neel@rebar.shop         ❌           ❌           0
```

zahra تمام پست‌ها را می‌سازد، اما توکن Instagram را radin و sattar متصل کرده‌اند. با سیاست "Owner-Only" جدید، پست‌های Instagram zahra fail می‌شوند.

## 📊 پست‌های آینده (امروز و فردا)

6 پست تایید شده آماده پابلیش امروز:
- 3 پست ساعت 16:30 UTC (FB + IG + LI) — `Build Ontario Strong.`
- 3 پست ساعت 18:30 UTC (FB + IG + LI) — `Built Bold, Delivered Right`

**⚠️ هشدار**: 2 پست Instagram بالا هم fail خواهند شد، چون صاحبشان zahra است و توکن IG ندارد.

15 پست آینده (1-5 آوریل) هنوز `qa_status=scheduled` هستند و نیاز به تایید (`neel_approved`) دارند.

## 🛠️ راه‌حل پیشنهادی

**مشکل اصلی**: سیاست Owner-Only با واقعیت کسب‌وکار سازگار نیست — zahra محتوا تولید می‌کند ولی radin توکن‌ها را مدیریت می‌کند.

**دو گزینه**:

### گزینه A: Team Token Fallback (محدود)
اگر صاحب پست توکن نداشت، از توکن **هم‌شرکتی** (company_id match) استفاده شود. این رفتار قبلی بود ولی حذف شد.

### گزینه B: Token Delegation
zahra باید مستقیماً Instagram را وصل کند (OAuth) تا توکن خودش را داشته باشد. بدون تغییر کد.

### مشکل Timeout IG
تایم‌اوت polling برای عکس‌ها از 20 ثانیه به 40 ثانیه افزایش یابد.

