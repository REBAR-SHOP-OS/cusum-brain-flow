
# جایگزینی ElevenLabs با Web Speech API (Google Voice)

## مشکل اصلی

تمام خطاهای WebSocket از SDK داخلی `@elevenlabs/react` می‌آیند. این SDK یک اتصال WebSocket جداگانه باز می‌کند که مدیریت lifecycle آن پیچیده و پر از حالت‌های ناپایدار است. هیچ تغییری در کد ما نمی‌تواند باگ‌های داخلی SDK را برطرف کند.

## راه‌حل: Web Speech API (Google Voice)

پروژه از قبل یک hook آماده و بدون خطا دارد: `useSpeechRecognition` در `src/hooks/useSpeechRecognition.ts`.

این hook از **Web Speech API** مرورگر استفاده می‌کند که:
- **هیچ WebSocket خارجی** باز نمی‌کند (مرورگر مستقیماً با Google ارتباط می‌گیرد)
- **هیچ API Key** لازم ندارد
- **هیچ edge function** لازم ندارد
- **بدون خطا** کار می‌کند چون lifecycle کاملاً توسط مرورگر مدیریت می‌شود
- در Chrome، Edge، و Safari پشتیبانی می‌شود
- **فارسی** پشتیبانی می‌شود (با تنظیم `lang = "fa-IR"`)

## تغییر یک فایل: `src/components/feedback/AnnotationOverlay.tsx`

### چه چیزی حذف می‌شود:
- تمام import های `useScribe` و `CommitStrategy` از `@elevenlabs/react`
- تمام لاجیک `scribe.connect()` / `scribe.disconnect()`
- state های `voiceConnecting` و `disconnectIfActive`
- فراخوانی `supabase.functions.invoke("elevenlabs-scribe-token")`

### چه چیزی اضافه می‌شود:
- import از `useSpeechRecognition` (که از قبل در پروژه وجود دارد)
- تنظیم `lang: "fa-IR"` برای پشتیبانی فارسی
- وقتی `isFinal` می‌شود، متن به `description` اضافه می‌شود
- `interimText` (متن موقت در حین صحبت) نمایش داده می‌شود
- دکمه میکروفون `start()` / `stop()` را صدا می‌زند

### تغییر در `useSpeechRecognition.ts`:
فقط یک خط: `lang` از `"en-US"` به `"fa-IR"` تغییر می‌کند تا فارسی به درستی شناسایی شود. البته چون این hook جاهای دیگری هم استفاده می‌شود، بهتر است `lang` را به عنوان پارامتر قابل تنظیم درآوریم.

## جزئیات فنی

```typescript
// در AnnotationOverlay.tsx:
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

const speech = useSpeechRecognition({
  onError: (err) => toast.error(err),
});

// وقتی transcript نهایی می‌شود، به description اضافه می‌شود:
// این کار با یک useEffect انجام می‌شود که transcripts را watch می‌کند
useEffect(() => {
  if (speech.transcripts.length > 0) {
    const lastFinal = speech.transcripts[speech.transcripts.length - 1];
    setDescription((prev) => (prev + " " + lastFinal.text).trim());
  }
}, [speech.transcripts]);

// دکمه:
<Button onClick={speech.isListening ? speech.stop : speech.start}>
  {speech.isListening ? <MicOff className="animate-pulse" /> : <Mic />}
</Button>

// متن موقت:
{speech.interimText && (
  <div className="mt-1 text-xs italic text-muted-foreground animate-pulse">
    🎙 {speech.interimText}
  </div>
)}
```

## برای پشتیبانی فارسی

یک پارامتر `lang` به `useSpeechRecognition` اضافه می‌شود. در `AnnotationOverlay` از `"fa-IR"` استفاده می‌کنیم. این باعث می‌شود Google Voice هم فارسی و هم انگلیسی را تشخیص دهد.

## خلاصه فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `src/components/feedback/AnnotationOverlay.tsx` | حذف ElevenLabs، جایگزینی با `useSpeechRecognition` |
| `src/hooks/useSpeechRecognition.ts` | اضافه کردن پارامتر `lang` (اختیاری، default: `"fa-IR"`) |

هیچ migration دیتابیس، edge function، یا API key جدیدی لازم نیست.
