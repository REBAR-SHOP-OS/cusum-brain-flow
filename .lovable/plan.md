
## رفع ریشه‌ای مشکل Vizzy Voice

### جمع‌بندی دقیق ریشه مشکل
مشکل فعلی دیگر از جنس model mismatch نیست؛ آن بخش قبلاً تا حدی حل شده چون الآن:
- توکن گرفته می‌شود
- درخواست SDP با `201` موفق برمی‌گردد
- ولی بعد از آن اتصال روی `Waiting for realtime channel...` می‌ماند و سپس `ICE disconnected/failed` رخ می‌دهد

شواهد کد و لاگ‌ها نشان می‌دهد ریشه اصلی این است:
1. در `src/hooks/useVoiceEngine.ts` و همین‌طور `src/components/vizzy/VizzyCallHandler.tsx` بعد از `createOffer()` و `setLocalDescription()`، SDP فوراً ارسال می‌شود
2. هیچ صبری برای کامل شدن `ICE gathering` وجود ندارد
3. در درخواست ثبت‌شده، offer ارسالی عملاً بدون `a=candidate` ارسال شده
4. علاوه بر آن، `RTCPeerConnection` بدون `iceServers` ساخته شده است

نتیجه: سمت مقابل پاسخ SDP می‌دهد، اما چون candidateهای محلی کامل/قابل‌استفاده ارسال نشده‌اند، مسیر WebRTC پایدار شکل نمی‌گیرد، data channel باز نمی‌شود، و اتصال وارد loop شکست می‌شود.

### کاری که باید انجام شود
1. یک helper مشترک WebRTC اضافه شود تا:
   - `RTCPeerConnection` را با `iceServers` مناسب بسازد
   - تا کامل شدن `iceGatheringState === "complete"` صبر کند
   - اگر candidate واقعی جمع نشد، خطای دقیق بدهد

2. در `src/hooks/useVoiceEngine.ts`:
   - مسیر handshake اصلاح شود:
     - `createOffer`
     - `setLocalDescription`
     - انتظار برای تکمیل ICE
     - سپس ارسال SDP کامل
   - اگر candidate جمع نشد، خطای واقعی مثل failure شبکه/NAT نشان داده شود
   - وضعیت `waiting_channel` فقط بعد از ارسال offer کامل شروع شود

3. در `src/components/vizzy/VizzyCallHandler.tsx`:
   - همان اصلاح دقیق اعمال شود
   - چون همین باگ handshake در این فایل هم تکرار شده و اگر فقط یک مسیر اصلاح شود، مشکل دوباره برمی‌گردد

4. منطق retry سخت‌گیرتر شود:
   - برای failureهای ناشی از نبود candidate یا بلاک شبکه، retry کور تکرار نشود
   - فقط failureهای transient دوباره تلاش شوند

5. پیام‌های UI/diagnostics اصلاح شوند:
   - به‌جای stuck روی `Waiting for realtime channel...`، وضعیت‌های واقعی‌تر نمایش داده شود
   - خطای نهایی روشن بگوید مشکل از route شبکه/WebRTC است، نه اینکه کاربر فکر کند برنامه فقط لود مانده

### فایل‌های درگیر
- `src/hooks/useVoiceEngine.ts`
- `src/components/vizzy/VizzyCallHandler.tsx`
- ترجیحاً یک helper جدید کوچک مثل:
  - `src/lib/webrtc/realtimeConnection.ts`

### نتیجه مورد انتظار بعد از اصلاح
- دیگر اتصال روی waiting channel گیر نمی‌کند
- data channel واقعاً باز می‌شود
- session به حالت connected می‌رسد
- retry loop بی‌دلیل تکرار نمی‌شود
- هر دو مسیر صوتی Vizzy و call-handler پایدار می‌شوند

### اعتبارسنجی بعد از اجرا
- در body درخواست SDP باید `a=candidate:` دیده شود
- در لاگ باید بعد از SDP، `Data channel OPEN` یا `session.created` ثبت شود
- وضعیت از `CONNECTING` به `LIVE SESSION` برسد
- دیگر بلافاصله `ICE disconnected/failed` رخ ندهد
- تست روی هر دو مسیر:
  - Vizzy voice UI
  - `VizzyCallHandler`

### جزئیات فنی
```text
before:
createOffer -> setLocalDescription -> POST SDP immediately

after:
createOffer -> setLocalDescription -> wait ICE gathering complete
           -> verify candidates exist
           -> POST full SDP
           -> wait for data channel open / connected state
```

این بار اصلاح روی خودِ لایه transport/WebRTC انجام می‌شود، نه فقط روی یکی از علائم ظاهری.
