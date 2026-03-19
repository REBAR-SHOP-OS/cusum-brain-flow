

# فیکس: قطع کامل مکالمه Nila با دکمه End Call

## مشکل
وقتی End Call زده می‌شود، `endSession()` صدا زده می‌شود ولی:
1. Audio در صف ممکن است همچنان پخش شود (فقط `pause` می‌شود ولی `onended` callback ها باقی می‌مانند)
2. درخواست‌های ترجمه در حال اجرا (`fetch` به edge function) ادامه پیدا می‌کنند و بعد از پایان، دوباره audio queue را پر می‌کنند
3. TTS fetch های در حال اجرا هم همینطور

## تغییرات

### فایل: `src/hooks/useAzinVoiceRelay.ts`

1. **اضافه کردن `AbortController`** — یک ref برای abort controller که هنگام `endSession` همه fetch های در حال اجرا (translate + TTS) را cancel می‌کند
2. **در `endSession`**:
   - ابتدا `abortController.abort()` برای لغو همه درخواست‌های شبکه‌ای
   - سپس Scribe disconnect
   - سپس stop و cleanup همه audio ها
   - Clear کردن transcripts (نه فقط partial)
3. **در `speakTranslation` و `onCommittedTranscript`**: پاس دادن `signal` از AbortController به همه `fetch` ها تا قابل لغو باشند
4. **Guard در callback ها**: بعد از هر await، چک کردن اینکه آیا session هنوز active است (abort نشده) تا هیچ عملیاتی بعد از End Call اجرا نشود

### فایل: `src/components/azin/AzinInterpreterVoiceChat.tsx`
- بدون تغییر — `handleClose` فعلی کافی است چون `endSession` را صدا می‌زند

### نتیجه
با زدن End Call، همه فعالیت‌ها (STT, ترجمه, TTS, پخش صدا) فوراً متوقف شده و هیچ چیزی در پس‌زمینه اجرا نمی‌شود.

