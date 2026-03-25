export type NilaLang = "en";

const translations = {
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
} as const;

export type NilaTranslations = typeof translations;

export function getNilaT(): NilaTranslations {
  return translations;
}
