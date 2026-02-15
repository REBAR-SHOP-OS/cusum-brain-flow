/**
 * Shared audio utility that pre-unlocks Web Audio on first user interaction.
 * This enables reliable audio playback on mobile browsers (especially iOS Safari)
 * which block audio.play() unless triggered within a user gesture context.
 */

let audioCtx: AudioContext | null = null;
let unlocked = false;

function unlockAudio() {
  if (unlocked) return;
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    // Play a silent buffer to unlock the context
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    unlocked = true;
  } catch {
    // AudioContext unavailable — fall back gracefully
  }
}

// Attach unlock listeners on import
if (typeof document !== "undefined") {
  const opts = { once: true, capture: true } as const;
  document.addEventListener("click", unlockAudio, opts);
  document.addEventListener("touchstart", unlockAudio, opts);
}

/**
 * Play a notification sound via AudioContext (bypasses autoplay restrictions
 * after the context has been unlocked by a user gesture).
 * Falls back to HTMLAudioElement if AudioContext is unavailable.
 */
export async function playNotificationSound(url: string): Promise<void> {
  // Try AudioContext path first
  if (audioCtx && unlocked) {
    try {
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.5;
      source.connect(gain);
      gain.connect(audioCtx.destination);
      source.start(0);
      return;
    } catch (err) {
      console.warn("[audioPlayer] AudioContext playback failed, trying fallback:", err);
    }
  }

  // Fallback: HTMLAudioElement (will fail on mobile without gesture, but best effort)
  try {
    const audio = new Audio(url);
    audio.volume = 0.5;
    await audio.play();
  } catch (err) {
    console.warn("[audioPlayer] Fallback audio playback failed:", err);
  }
}
