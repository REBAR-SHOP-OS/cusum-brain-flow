
# رفع خطای "WebSocket is not connected" در ورودی صوتی اسکرین‌شات

## ریشه مشکل

خطای `Uncaught Error: WebSocket is not connected` از سه نقطه در `AnnotationOverlay.tsx` می‌آید:

1. **`useEffect` هنگام بستن dialog** — وقتی `open=false` می‌شود، `scribe.disconnect()` صدا زده می‌شود حتی اگر WebSocket هنوز در حال اتصال باشد یا اصلاً متصل نشده باشد.
2. **`handleSend`** — قبل از ارسال، `scribe.disconnect()` بدون محافظت `try/catch` صدا زده می‌شود.
3. **`toggleVoice`** — `scribe.disconnect()` ممکن است در لحظه‌ای صدا زده شود که WebSocket هنوز کاملاً متصل نشده.

## راه‌حل

تمام فراخوانی‌های `scribe.disconnect()` را درون `try/catch` محافظت می‌کنیم و یک helper تمیز `safeDisconnect` می‌سازیم. همچنین یک `isConnecting` ref اضافه می‌کنیم تا از صدا زدن `disconnect` در حین اتصال جلوگیری کنیم.

## جزئیات فنی

**فایل: `src/components/feedback/AnnotationOverlay.tsx`**

### تغییر ۱ — اضافه کردن `isConnectingRef` و `safeDisconnect`

```typescript
const isConnectingRef = useRef(false);

const safeDisconnect = useCallback(() => {
  try {
    if (!isConnectingRef.current) {
      scribe.disconnect();
    }
  } catch {
    // WebSocket already closed — ignore
  }
  setInterimText("");
}, [scribe]);
```

### تغییر ۲ — `toggleVoice` با محافظت کامل

```typescript
const toggleVoice = useCallback(async () => {
  if (isVoiceActive || isConnectingRef.current) {
    safeDisconnect();
    return;
  }
  try {
    isConnectingRef.current = true;
    setVoiceConnecting(true);
    await navigator.mediaDevices.getUserMedia({ audio: true });
    const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
    if (error || !data?.token) throw new Error("Could not get scribe token");
    await scribe.connect({ token: data.token, microphone: {...} });
  } catch (err) {
    safeDisconnect();
    toast.error("...");
  } finally {
    isConnectingRef.current = false;
    setVoiceConnecting(false);
  }
}, [isVoiceActive, scribe, safeDisconnect]);
```

### تغییر ۳ — `useEffect` و `handleSend` با `safeDisconnect`

همه جاهایی که `scribe.disconnect()` مستقیم صدا زده می‌شد، با `safeDisconnect()` جایگزین می‌شوند.

## خلاصه

- فقط یک فایل تغییر می‌کند: `src/components/feedback/AnnotationOverlay.tsx`
- هیچ API جدیدی لازم نیست
- هیچ تغییر دیتابیسی لازم نیست
- کد بقیه سیستم تحت تاثیر قرار نمی‌گیرد
