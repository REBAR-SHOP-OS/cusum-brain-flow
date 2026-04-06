

# رفع مشکلات ویزی: زمان دقیق کانادا، حذف عذرخواهی، و قطع نکردن صحبت

## مشکلات فعلی

1. **زمان**: `formattedNow` شامل ثانیه نیست — مدل AI نمی‌تواند زمان دقیق محاسبه کند. همچنین timezone صراحتاً `America/Toronto` اجبار نشده.
2. **عذرخواهی**: هیچ دستوری برای ممنوعیت عذرخواهی وجود ندارد.
3. **قطع صحبت**: VAD با `silenceDurationMs: 500` و `vadThreshold: 0.5` خیلی حساس است — ویزی وسط حرف یوزر شروع به صحبت می‌کند.

## تغییرات

### 1. `src/lib/dateConfig.ts` — اضافه کردن ثانیه به `formattedNow`
در `getTimeContextInTimezone`، `second: "2-digit"` اضافه شود تا زمان دقیق‌تر باشد.

### 2. `src/hooks/useVizzyVoiceEngine.ts` — سه تغییر

**الف) REAL-TIME CLOCK**: اجبار `America/Toronto` و اضافه کردن دستور دقیق‌تر:
```
═══ REAL-TIME CLOCK (CRITICAL — NEVER GET THIS WRONG) ═══
You are in CANADA timezone: America/Toronto (Eastern Time).
The EXACT current time at session start: [formattedNow with seconds].
ALWAYS use America/Toronto. NEVER use UTC or any other timezone.
```

**ب) بخش جدید در VIZZY_INSTRUCTIONS** — ممنوعیت عذرخواهی:
```
═══ NO APOLOGIES (CEO ORDER) ═══
NEVER apologize. NEVER say "sorry", "I apologize", "my mistake", "ببخشید", "عذر می‌خوام".
When corrected, just give the RIGHT answer immediately.
Instead of "Sorry, you're right" → "Right, it's 11:51."
```

**ج) بخش جدید** — ممنوعیت قطع صحبت:
```
═══ TURN-TAKING (CEO ORDER) ═══
NEVER interrupt. ALWAYS wait until the user finishes speaking completely.
Complete YOUR response fully before returning to listening mode.
First answer completely, then listen, then answer again. Never talk over the user.
```

**د) VAD Settings**: تغییر پارامترها برای صبر بیشتر:
- `vadThreshold`: 0.5 → 0.6
- `silenceDurationMs`: 500 → 800
- `prefixPaddingMs`: 300 → 400

**ه) Banned phrases**: اضافه کردن عذرخواهی‌ها به لیست BANNED:
- "Sorry" / "I'm sorry" / "I apologize" / "My mistake"
- "ببخشید" / "عذر می‌خوام"

### 3. `supabase/functions/voice-engine-token/index.ts` — VAD defaults
بروزرسانی defaults سرور: `vadThreshold: 0.6`, `silenceDurationMs: 800`, `prefixPaddingMs: 400`

## نتیجه
- ویزی همیشه ساعت دقیق کانادا (Eastern Time) را می‌گوید
- هرگز عذرخواهی نمی‌کند
- وسط صحبت یوزر حرف نمی‌زند — اول کامل جواب می‌دهد، بعد گوش می‌دهد

