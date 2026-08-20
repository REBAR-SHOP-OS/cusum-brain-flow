// Tiny SpeechSynthesis wrapper for Auto Clearance Mode.
// Silent no-op on browsers without speechSynthesis. Operator can mute via UI.

let enabled = true;

export function setVoiceEnabled(on: boolean) {
  enabled = on;
  if (!on && typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function isVoiceEnabled() {
  return enabled;
}

export function speak(text: string) {
  if (!enabled) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1;
    u.volume = 1;
    u.lang = "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}
