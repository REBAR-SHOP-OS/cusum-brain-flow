/**
 * Plays the Mockingjay whistle notification sound.
 */
export function playMockingjayWhistle(): void {
  try {
    const audio = new Audio("/mockingjay.mp3");
    audio.volume = 0.5;
    audio.play();
  } catch { }
}
