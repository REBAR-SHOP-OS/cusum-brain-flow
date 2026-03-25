export type NilaLang = "fa" | "en";

const translations = {
  fa: {
    title: "نیلا",
    subtitle: "دستیار صوتی",
    ready: "آماده",
    listening: "در حال گوش دادن...",
    processing: "در حال پردازش...",
    speaking: "در حال صحبت...",
    modeNormal: "عادی",
    modeSilent: "سکوت",
    modeTranslate: "ترجمه",
    switchedTo: "تغییر به حالت",
    placeholder: "پیام خود را بنویسید...",
    send: "ارسال",
    endCall: "پایان",
    selectVoice: "انتخاب صدا",
    downloadPdf: "دانلود گزارش",
    noMessages: "هنوز پیامی نیست. شروع به صحبت کنید!",
  },
  en: {
    title: "Nila",
    subtitle: "Voice Assistant",
    ready: "Ready",
    listening: "Listening...",
    processing: "Processing...",
    speaking: "Speaking...",
    modeNormal: "Normal",
    modeSilent: "Silent",
    modeTranslate: "Translate",
    switchedTo: "Switched to",
    placeholder: "Type your message...",
    send: "Send",
    endCall: "End",
    selectVoice: "Select voice",
    downloadPdf: "Download report",
    noMessages: "No messages yet. Start speaking!",
  },
} as const;

export type NilaTranslations = typeof translations.en;

export function getNilaT(lang: NilaLang): NilaTranslations {
  return translations[lang];
}

export function loadNilaLang(): NilaLang {
  const stored = localStorage.getItem("nila-lang");
  return stored === "en" ? "en" : "fa";
}

export function saveNilaLang(lang: NilaLang) {
  localStorage.setItem("nila-lang", lang);
}
