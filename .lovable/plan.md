

## تشخیص خودکار زبان در ضبط صدا

### وضعیت فعلی
- `useSpeechRecognition` (Web Speech API) به صورت پیش‌فرض روی `"fa-IR"` تنظیم شده - فقط فارسی تشخیص می‌دهد
- `AnnotationOverlay` صراحتاً `lang: "fa-IR"` ارسال می‌کند
- `useMeetingTranscription` روی `"en-US"` قفل شده
- `useRealtimeTranscribe` (ElevenLabs Scribe) از قبل تشخیص خودکار زبان دارد - نیاز به تغییر ندارد

### راه‌حل
حذف محدودیت زبان از Web Speech API تا مرورگر به صورت خودکار زبان گفتار را تشخیص دهد.

### تغییرات

#### 1. `src/hooks/useSpeechRecognition.ts`
- حذف پیش‌فرض `"fa-IR"` از خط ۵۸
- اگر `lang` ارسال نشود، `recognition.lang` اصلاً ست نشود (مرورگر خودش تشخیص می‌دهد)
- اگر `lang` ارسال شود، همان مقدار استفاده شود (سازگاری عقبرو حفظ شود)

```typescript
// قبل:
recognition.lang = optionsRef.current?.lang ?? "fa-IR";

// بعد:
if (optionsRef.current?.lang) {
  recognition.lang = optionsRef.current.lang;
}
// اگر lang نباشد، ست نمی‌شود و مرورگر خودکار تشخیص می‌دهد
```

#### 2. `src/components/feedback/AnnotationOverlay.tsx`
- حذف `lang: "fa-IR"` از فراخوانی `useSpeechRecognition` (خط ۴۶)

#### 3. `src/hooks/useMeetingTranscription.ts`
- حذف `recognition.lang = "en-US"` از خط ۹۴ تا زبان خودکار تشخیص داده شود

#### 4. فایل‌های بدون تغییر
- `ChatInput.tsx`, `LiveChat.tsx`, `ComposeEmailDialog.tsx`, `EmailReplyComposer.tsx`, `MessageThread.tsx`, `LiveCallPanel.tsx` - هیچکدام `lang` ارسال نمی‌کنند، پس با حذف پیش‌فرض خودکار درست می‌شوند
- `useRealtimeTranscribe.ts` (ElevenLabs) - از قبل تشخیص خودکار دارد

### نکته فنی
Web Speech API کروم وقتی `lang` ست نشود، از زبان مرورگر/سیستم‌عامل استفاده می‌کند و تا حدی تشخیص خودکار انجام می‌دهد. این بهترین رفتار ممکن با این API است.

