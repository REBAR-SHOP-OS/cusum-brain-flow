import { playNotificationSound } from "./audioPlayer";

/**
 * Plays the Mockingjay whistle notification sound.
 * Uses the pre-unlocked AudioContext for reliable mobile playback.
 */
export function playMockingjayWhistle(): void {
  playNotificationSound("/mockingjay.mp3").catch((err) => {
    console.warn("[notificationSound] Failed to play mockingjay whistle:", err);
  });
}
