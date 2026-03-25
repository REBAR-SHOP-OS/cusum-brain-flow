

## اعمال زبان انتخاب‌شده به تشخیص گفتار

### مشکل
وقتی کاربر زبانی را از لیست انتخاب می‌کند، این انتخاب به موتور Speech Recognition اعمال نمی‌شود. بنابراین متن همیشه به انگلیسی تشخیص داده می‌شود.

### تغییرات

**فایل: `src/components/chat/ChatInput.tsx`**

1. اضافه کردن state: `const [voiceLang, setVoiceLang] = useState("en")`
2. اضافه کردن mapping از کدهای ساده به BCP-47:
   ```typescript
   const LANG_BCP47: Record<string, string> = {
     en: "en-US", fa: "fa-IR", ar: "ar-SA", es: "es-ES", fr: "fr-FR",
     hi: "hi-IN", zh: "zh-CN", de: "de-DE", tr: "tr-TR", pt: "pt-BR",
     ru: "ru-RU", ko: "ko-KR", ja: "ja-JP", ur: "ur-PK",
     it: "it-IT", nl: "nl-NL", pl: "pl-PL", uk: "uk-UA",
     sv: "sv-SE", no: "nb-NO", da: "da-DK", fi: "fi-FI",
     cs: "cs-CZ", ro: "ro-RO", hu: "hu-HU", el: "el-GR",
     th: "th-TH", vi: "vi-VN", id: "id-ID", ms: "ms-MY",
     bn: "bn-BD", ta: "ta-IN", sw: "sw-KE", he: "he-IL",
     fil: "fil-PH", ca: "ca-ES",
   };
   ```
3. پاس دادن `lang` به `useSpeechRecognition`:
   ```typescript
   const speech = useSpeechRecognition({
     onError: ...,
     lang: LANG_BCP47[voiceLang] || "en-US",
   });
   ```
4. پاس دادن `lang` و `onLangChange` به هر دو `VoiceInputButton`:
   ```typescript
   <VoiceInputButton ... lang={voiceLang} onLangChange={(l) => { if (speech.isListening) speech.stop(); setVoiceLang(l); }} />
   ```

**فایل: `src/hooks/useSpeechRecognition.ts`**

5. وقتی `lang` تغییر می‌کند، recognition باید restart شود تا زبان جدید اعمال شود. یک `useEffect` یا تغییر در `start` لازم است تا `recognition.lang` را از آخرین مقدار `optionsRef` بخواند (این الان هم کار می‌کند چون `optionsRef.current` همیشه به‌روز است، اما باید وقتی زبان عوض می‌شود recognition متوقف و دوباره شروع شود — این کار را در `onLangChange` ChatInput انجام می‌دهیم با `speech.stop()` قبل از `setVoiceLang`).

### فایل‌های درگیر
- `src/components/chat/ChatInput.tsx`
- (hook نیاز به تغییر ندارد — فقط ChatInput)

