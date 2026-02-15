/**
 * Shared audio utility with robust Web Audio unlock for mobile browsers.
 * Keeps retrying unlock on every user interaction until AudioContext is confirmed running.
 * Pre-caches notification sounds for instant playback.
 */

let audioCtx: AudioContext | null = null;
let unlocked = false;
const audioBufferCache = new Map<string, AudioBuffer>();

async function preCacheSound(url: string): Promise<void> {
  if (!audioCtx || audioBufferCache.has(url)) return;
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioBufferCache.set(url, audioBuffer);
    console.log("[audioPlayer] pre-cached:", url);
  } catch (err) {
    console.warn("[audioPlayer] pre-cache failed:", url, err);
  }
}

async function unlockAudio() {
  if (unlocked) return;
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }

    // Play a silent buffer to satisfy gesture requirement
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);

    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    if (audioCtx.state === "running") {
      unlocked = true;
      console.log("[audioPlayer] unlocked");
      // Remove listeners now that we're confirmed running
      document.removeEventListener("click", unlockAudio, true);
      document.removeEventListener("touchstart", unlockAudio, true);
      // Pre-cache the notification sound
      preCacheSound("/mockingjay.mp3");
    }
    // If state is NOT running, listeners stay active for next interaction
  } catch (err) {
    console.warn("[audioPlayer] unlock attempt failed:", err);
  }
}

// Attach unlock listeners — NO { once: true } so they retry until success
if (typeof document !== "undefined") {
  document.addEventListener("click", unlockAudio, true);
  document.addEventListener("touchstart", unlockAudio, true);
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

      let audioBuffer = audioBufferCache.get(url);
      if (audioBuffer) {
        console.log("[audioPlayer] playing from cache:", url);
      } else {
        console.log("[audioPlayer] fetching audio:", url);
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioBufferCache.set(url, audioBuffer);
      }

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

  // Fallback: HTMLAudioElement
  try {
    const audio = new Audio(url);
    audio.volume = 0.5;
    await audio.play();
  } catch (err) {
    console.warn("[audioPlayer] Fallback audio playback failed:", err);
  }
}
