

## Upgrade Voice-to-Text Button: Multi-Language Support + New Design

### What
The current voice-to-text button (VoiceInputButton) only uses the browser's default language. It needs to:
1. Support all languages in `LANG_LABELS` (English, Farsi, Arabic, Spanish, French, Hindi, Chinese, German, Turkish, Portuguese, Russian, Korean, Japanese, Urdu)
2. Have a redesigned appearance — show the selected language flag, and allow cycling/selecting language before or during use

### Current State
- `useSpeechRecognition` already accepts a `lang` option (BCP-47 tag like `"fa-IR"`, `"en-US"`)
- But `MessageThread.tsx` calls it without any `lang` parameter (line 212)
- The `VoiceInputButton` is a plain mic icon with no language indication

### Changes

**File**: `src/components/teamhub/MessageThread.tsx`

1. Add state: `voiceLang` (default to `myLang` from props — the user's preferred language)
2. Pass `lang` to `useSpeechRecognition`: map the 2-letter code to BCP-47 (e.g., `"fa"` → `"fa-IR"`, `"en"` → `"en-US"`)
3. Replace the `VoiceInputButton` with an upgraded inline component:
   - A split button: **language selector dropdown** (shows flag + language name) + **mic toggle**
   - Clicking the flag/language part opens a small popover with all `LANG_LABELS` languages to pick from
   - Clicking the mic part starts/stops speech recognition in the selected language
   - When listening: show pulse animation + selected language flag
   - Compact design matching the existing composer toolbar style

**File**: `src/components/chat/VoiceInputButton.tsx`

Update to accept optional `lang` prop and display a language selector:
- Add `lang?: string`, `onLangChange?: (lang: string) => void`, `languages?: Record<string, {name: string; flag: string}>`
- Show a small dropdown trigger (flag icon) next to the mic icon
- Use a Popover with a list of languages — clicking one sets the voice recognition language
- When listening, show the active language flag with the pulse animation

### BCP-47 Mapping
```typescript
const langToBcp47: Record<string, string> = {
  en: "en-US", fa: "fa-IR", ar: "ar-SA", es: "es-ES",
  fr: "fr-FR", hi: "hi-IN", zh: "zh-CN", de: "de-DE",
  tr: "tr-TR", pt: "pt-BR", ru: "ru-RU", ko: "ko-KR",
  ja: "ja-JP", ur: "ur-PK",
};
```

### Files Changed

| File | Change |
|---|---|
| `src/components/chat/VoiceInputButton.tsx` | Add language selector popover, show flag, redesigned appearance |
| `src/components/teamhub/MessageThread.tsx` | Add `voiceLang` state, pass BCP-47 lang to `useSpeechRecognition`, pass lang props to VoiceInputButton |

