
# سه تغییر موازی: ویس در چت‌باکس اسکرین‌شات + پشتیبانی فارسی + نوتیفیکیشن به زبان ترجیحی

## مشکلات موجود

1. **چت‌باکس اسکرین‌شات (AnnotationOverlay)** هیچ دکمه‌ای برای ورودی صوتی ندارد. یوزر باید متن را دستی تایپ کند.
2. **نوتیفیکیشن‌ها** (push و in-app) همیشه به انگلیسی ارسال می‌شوند، حتی اگر یوزر زبان فارسی یا دیگری تنظیم کرده باشد.

---

## تغییر ۱ – دکمه ویس در AnnotationOverlay

**فایل: `src/components/feedback/AnnotationOverlay.tsx`**

### راهکار: ElevenLabs Realtime Scribe (useScribe)
از `@elevenlabs/react` SDK که از قبل در پروژه نصب است، از `useScribe` hook استفاده می‌شود. این روش:
- از همه زبان‌ها از جمله **فارسی** پشتیبانی می‌کند (auto-detect)
- بدون نیاز به زبان ثابت، به صورت خودکار زبان را تشخیص می‌دهد
- از edge function موجود `elevenlabs-scribe-token` برای احراز هویت امن استفاده می‌کند

### چه اتفاقی می‌افتد:
- یک آیکون میکروفون در کنار Textarea نمایش داده می‌شود
- یوزر کلیک می‌کند ← درخواست میکروفون می‌شود
- صدا real-time به متن تبدیل شده و در `description` تایپ می‌شود
- وقتی یوزر دوباره کلیک کند یا پیام را بفرستد، ضبط متوقف می‌شود
- هنگام ضبط آیکون قرمز و چشمک‌زن می‌شود

### کد کلیدی:
```text
const scribe = useScribe({
  modelId: "scribe_v2_realtime",
  commitStrategy: "vad",           // auto-detect silence
  onPartialTranscript: (data) => {
    setInterimText(data.text);
  },
  onCommittedTranscript: (data) => {
    setDescription(prev => (prev + " " + data.text).trim());
    setInterimText("");
  },
});

const toggleVoice = async () => {
  if (scribe.isConnected) {
    scribe.disconnect();
  } else {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    const { data } = await supabase.functions.invoke("elevenlabs-scribe-token");
    await scribe.connect({ token: data.token });
  }
};
```

UI در بخش Description + Send:
```text
<div className="flex gap-2 items-end">
  <div className="relative flex-1">
    <Textarea ... />
    {interimText && <div className="italic text-muted-foreground text-xs">{interimText}</div>}
  </div>
  <Button onClick={toggleVoice} variant={isConnected ? "destructive" : "outline"}>
    {isConnected ? <MicOff className="animate-pulse" /> : <Mic />}
  </Button>
  <Button onClick={handleSend}>Send</Button>
</div>
```

---

## تغییر ۲ – نوتیفیکیشن‌ها به زبان ترجیحی یوزر

این بخش در دو قدم کار می‌کند:

### قدم A: AnnotationOverlay – نوتیفیکیشن به صاحبان تسک

**فایل: `src/components/feedback/AnnotationOverlay.tsx`**

وقتی تسک ساخته می‌شود، profile صاحبان (Sattar و Radin) را می‌خوانیم تا `preferred_language` آن‌ها را بدانیم. سپس عنوان و توضیح نوتیفیکیشن را از طریق `translate-message` edge function به زبان آن‌ها ترجمه می‌کنیم.

```text
// برای هر profileId که باید نوتیف دریافت کند:
const { data: targetProf } = await supabase
  .from("profiles")
  .select("user_id, preferred_language")
  .eq("id", profileId)
  .maybeSingle();

const lang = targetProf?.preferred_language || "en";
let notifTitle = "📸 Screenshot Feedback";
let notifDesc = description.trim().slice(0, 200) || "New annotated screenshot";

if (lang !== "en") {
  const { data: translated } = await supabase.functions.invoke("translate-message", {
    body: { text: notifTitle + "\n" + notifDesc, sourceLang: "en", targetLangs: [lang] },
  });
  if (translated?.translations?.[lang]) {
    [notifTitle, notifDesc] = translated.translations[lang].split("\n");
  }
}
```

### قدم B: trigger موجود در DB برای وقتی تسک Resolved می‌شود

مشکل: تریگر `notify_feedback_owner_on_resolve` که در migration قبلی نوشتیم، نوتیفیکیشن را فقط به انگلیسی می‌فرستد. باید آپدیت شود تا `preferred_language` owner را هم بخواند و متن را ترجمه کند.

**راه‌حل ساده‌تر:** به جای ترجمه داخل trigger (که در PL/pgSQL پیچیده است)، از یک edge function جدید `notify-feedback-owner` استفاده می‌کنیم. تریگر فعلی را حذف و به جای آن یک database webhook درست می‌کنیم که این edge function را صدا بزند.

---

## خلاصه فایل‌های تغییریافته

| فایل | تغییر |
|------|-------|
| `src/components/feedback/AnnotationOverlay.tsx` | + useScribe hook، + دکمه میکروفون، + ترجمه نوتیفیکیشن |
| `supabase/functions/notify-feedback-owner/index.ts` | جدید: edge function برای نوتیفیکیشن resolved با زبان ترجیحی |
| Database migration | تریگر قدیمی را آپدیت می‌کنیم تا به edge function جدید اشاره کند |

---

## جزئیات فنی

- **زبان فارسی**: ElevenLabs `scribe_v2_realtime` به صورت auto-detect عمل می‌کند. نیازی به تنظیم دستی زبان نیست و فارسی، عربی، انگلیسی و ۹۹+ زبان دیگر پشتیبانی می‌شود.
- **هیچ API key جدیدی نیاز نیست**: `ELEVENLABS_API_KEY` از قبل موجود است و edge function `elevenlabs-scribe-token` هم آماده است.
- **ترجمه**: از edge function `translate-message` که از قبل در پروژه وجود دارد استفاده می‌شود.
- **عدم تاثیر روی سایر بخش‌ها**: تغییرات کاملاً داخل `AnnotationOverlay.tsx` و edge function جدید است.
