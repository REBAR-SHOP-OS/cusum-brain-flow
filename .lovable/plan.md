

## مشکل: آپلود فایل در Team Chat با خطا مواجه می‌شود

### تحلیل
- باکت `team-chat-files` هیچ محدودیت MIME type ندارد و عمومی (public) است
- فایل input هیچ `accept` محدودکننده‌ای ندارد
- محدودیت سایز فعلی: 10MB (کافی برای .docx)
- **علت اصلی**: مشکل `bad_jwt` که در لاگ‌ها مشاهده می‌شود. Storage API هم مثل دیتابیس نیاز به JWT معتبر دارد. اصلاح `refreshSessionIfNeeded` فقط در `usePurchasingList.ts` اعمال شده ولی در Team Chat اعمال **نشده**.

### راه‌حل

**1. ایجاد یک هوک مشترک `useSessionGuard`** برای اعتبارسنجی session قبل از هر عملیات:
- فایل جدید: `src/hooks/useSessionGuard.ts`
- منطق: `getUser()` → اگر خطا → `refreshSession()` → اگر خطا → `signOut` + toast
- این هوک در هر جایی که upload/write انجام می‌شود قابل استفاده خواهد بود

**2. اعمال session guard در `MessageThread.tsx`**:
- قبل از `supabase.storage.upload()` تابع `ensureSession()` فراخوانی شود
- نمایش پیام خطای دقیق‌تر: `error.message` بجای پیام عمومی

**3. اعمال session guard در `DockChatBox.tsx`**:
- همان منطق قبل از upload در `uploadFiles()`

**4. افزایش محدودیت سایز فایل** از 10MB به 50MB (مطابق با استاندارد پروژه در `upload-validation.ts`)

### فایل‌های تغییر
- `src/hooks/useSessionGuard.ts` — فایل جدید
- `src/components/teamhub/MessageThread.tsx` — اضافه کردن session check + بهبود خطا
- `src/components/chat/DockChatBox.tsx` — اضافه کردن session check

