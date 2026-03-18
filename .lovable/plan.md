

## طرح: اضافه کردن آیکون "عدم تایید" برای تسک‌های تکمیل‌شده

### مشکل فعلی
آیکون رد (reject) فقط برای Neel روی تسک‌های تکمیل‌شده Radin نمایش داده می‌شود (خط ۱۱۱۹). کاربر می‌خواهد خود Radin هم بتواند تسک‌های تکمیل‌شده‌اش را reject کند تا دوباره به لیست تسک‌های فعال برگردند.

### تغییرات

**فایل: `src/pages/Tasks.tsx`**

شرط فعلی در خط ۱۱۱۹:
```typescript
{!task.review_status && task.assigned_to === RADIN_PROFILE_ID && currentProfileId === NEEL_PROFILE_ID && (
```

تغییر به:
```typescript
{!task.review_status && (
  (task.assigned_to === RADIN_PROFILE_ID && currentProfileId === NEEL_PROFILE_ID) ||
  (task.assigned_to === currentProfileId)
) && (
```

این تغییر باعث می‌شود:
- Neel همچنان بتواند تسک‌های Radin را approve/reject کند (رفتار قبلی حفظ شود)
- هر کاربر بتواند تسک‌های تکمیل‌شده خودش را reject کند و به حالت open برگرداند
- دکمه approve فقط برای Neel نمایش داده شود (Radin فقط reject می‌بیند)

برای تفکیک بهتر، دکمه‌های نمایش داده شده به کاربر خودش فقط شامل آیکون reject (بازگشت به open) خواهد بود، نه approve.

