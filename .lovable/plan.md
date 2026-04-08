
مسئله را ریشه‌ای بررسی کردم. نتیجه روشن است:

1. الان مشکل «کانکت نشدن» بین فرانت‌اند شما و سرویس Realtime صوتی است، نه بین UI و بک‌اند توکن.
2. به طور دقیق:
   - تابع `voice-engine-token` سالم جواب می‌دهد و `client_secret` برمی‌گرداند.
   - لاگ شبکه نشان می‌دهد درخواست به `voice-engine-token` با `200` موفق شده.
   - لاگ‌های بک‌اند هم چندین بار موفق بودن `voice-engine-token` را تأیید می‌کنند.
   - بنابراین اتصال تا مرحله گرفتن توکن برقرار است.
3. جایی که شکست می‌خورد:
   - بعد از گرفتن توکن، کد در `src/hooks/useVoiceEngine.ts` مستقیماً از مرورگر به `https://api.openai.com/v1/realtime?model=...` وصل می‌شود.
   - همین مرحله WebRTC/SDP handshake کامل نمی‌شود.
   - چون `data channel` باز نمی‌شود و `RTCPeerConnection` هم به `connected` نمی‌رسد، UI روی `CONNECTING` می‌ماند، بعد timeout می‌خورد، و auto-retry شروع می‌شود.
4. شواهد:
   - در کنسول فقط `Auto-retry 1/3`, `2/3`, `3/3` دیده می‌شود.
   - در UI هم وضعیت `CONNECTING` و بعد `OFFLINE/Reconnecting` دیده شده.
   - اگر handshake کامل می‌شد، باید لاگ‌های `Data channel OPEN` یا `Session marked CONNECTED` اتفاق می‌افتاد.

پس پاسخ مستقیم به سؤال شما:
- الان Vizzy به `voice-engine-token` وصل می‌شود.
- اما به سرویس Realtime صوتی OpenAI از داخل مرورگر وصل نمی‌شود.
- یعنی شکست اصلی در «اتصال WebRTC مرورگر → OpenAI Realtime endpoint» است.

برنامه حل ریشه‌ای:

1. ابزار تشخیصی دقیق به `useVoiceEngine.ts` اضافه شود
- تفکیک خطاها به این مراحل:
  - microphone permission
  - token fetch
  - SDP POST to realtime endpoint
  - setRemoteDescription
  - data channel open
  - peer connection state changes
- به جای پیام کلی `Could not connect`, خطای دقیق مرحله‌ای نشان داده شود:
  - `Token acquired, realtime handshake failed`
  - `SDP exchange failed`
  - `Peer connection never established`
  - `Remote audio connected but session channel not opened`
- این کار باعث می‌شود دیگر مشکل پشت یک toast عمومی پنهان نشود.

2. مسیر اتصال مرورگر به Realtime سخت‌جان شود
- در `src/hooks/useVoiceEngine.ts` برای بخش handshake این موارد اضافه شود:
  - timeout جداگانه برای هر مرحله، نه یک timeout کلی
  - ثبت آخرین مرحله موفق (`token ok`, `offer created`, `sdp posted`, `remote description set`)
  - fallback when SDP request succeeds but channel never opens
  - تشخیص خطاهای fetch/network/CORS/WebRTC به صورت جدا
- الان کد فقط در نهایت به `error` می‌افتد؛ باید دلیل واقعی را نگه دارد و به UI بدهد.

3. auto-retry فعلی اصلاح شود
- در `src/components/vizzy/VizzyVoiceChat.tsx` و `useVoiceEngine.ts` retry فقط برای خطاهای موقتی انجام شود:
  - transient network issue
  - disconnected/failed ICE
- برای خطاهای ساختاری retry بی‌فایده است و فقط loop می‌سازد:
  - invalid realtime handshake
  - blocked network path
  - browser incompatibility
  - repeated SDP failure
- به جای 3 retry کور، retry policy مبتنی بر نوع خطا پیاده شود.

4. مسیر Realtime از نظر runtime محافظت شود
- چون الان توکن می‌آید ولی handshake نهایی نه، باید در همان hook موارد زیر اضافه شود:
  - لاگ کامل `sdpResponse.status` و response body
  - ثبت `pc.connectionState`, `iceConnectionState`, `signalingState`
  - timeout مخصوص `dc.onopen`
  - timeout مخصوص `pc.ontrack`
- این باعث می‌شود بفهمیم failure دقیقاً روی کدام لایه است:
  - HTTP SDP exchange
  - ICE negotiation
  - data channel
  - remote audio track

5. UI وضعیت واقعی اتصال را نمایش دهد
- در `src/components/vizzy/VizzyVoiceChat.tsx` متن `CONNECTING` باید مرحله‌ای شود:
  - Requesting microphone
  - Getting secure voice token
  - Negotiating voice session
  - Waiting for realtime channel
  - Voice connected
- اگر شکست رخ دهد، زیر status یک diagnostic reason نمایش داده شود.
- این تغییر هم برای شما و هم برای کاربر نهایی مهم است چون سریع می‌فهمید مشکل کجاست.

6. مسیر fallback دائمی برای پایداری اضافه شود
- چون اتصال مستقیم مرورگر به OpenAI Realtime شکننده است، باید یک fallback مطمئن تعریف شود:
  - اگر handshake realtime در مدت مشخص کامل نشد، session به حالت degraded برود
  - به‌جای loop بی‌نهایت، پیام روشن نمایش داده شود که:
    `Voice token issued successfully, but realtime media channel could not be established.`
- اگر معماری پروژه اجازه بدهد، بهترین راه دائمی این است که transport لایه voice از UI کمتر وابسته به handshake شکننده‌ی فعلی باشد یا مسیر جایگزین کنترل‌شده داشته باشد.
- حداقل باید failure graceful باشد، نه hanging + retry loop.

7. بررسی کدهای مرتبط برای همسان‌سازی
- این فایل‌ها باید با هم بررسی و هماهنگ شوند:
  - `src/hooks/useVoiceEngine.ts`
  - `src/hooks/useVizzyVoiceEngine.ts`
  - `src/components/vizzy/VizzyVoiceChat.tsx`
  - `supabase/functions/voice-engine-token/index.ts`
  - `src/components/vizzy/VizzyCallHandler.tsx`
- چون `VizzyCallHandler` هم الگوی مشابه handshake مستقیم به OpenAI دارد، اگر ریشه مشکل در handshake باشد باید همان الگو آنجا هم harden شود تا دوباره همین باگ از مسیر دیگری برنگردد.

8. نتیجه‌ای که بعد از اصلاح باید به دست بیاید
- سیستم دقیقاً اعلام کند به کجا وصل نشده:
  - token service
  - realtime SDP endpoint
  - peer connection
  - data channel
- timeout عمومی و مبهم حذف شود
- retry loop کور حذف شود
- اگر ارتباط realtime شدنی نباشد، failure message دقیق و قابل اقدام داده شود
- اتصال‌های موفق سریع‌تر و شفاف‌تر شوند

جمع‌بندی فنی:
```text
Current flow:
UI -> voice-engine-token ✅
UI -> OpenAI Realtime WebRTC/SDP ❌
Data channel open ❌
Peer connected ❌
Auto-retry loop ✅ (but blind)

Root cause:
The failure is after token issuance and during browser-side realtime WebRTC session establishment.

Permanent fix:
Instrument each connection phase, classify errors, stop blind retries, expose exact failure reason, and harden the realtime handshake/fallback path.
```
