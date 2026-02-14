let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/**
 * Plays the iconic Mockingjay 4-note whistle from The Hunger Games.
 * Synthesized with Web Audio API — no files needed.
 */
export function playMockingjayWhistle(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Mockingjay whistle: G5 → B5 → A5 (vibrato) → D5 (fade)
    const notes: { freq: number; start: number; dur: number; vibrato?: boolean }[] = [
      { freq: 784, start: 0, dur: 0.25 },       // G5
      { freq: 988, start: 0.28, dur: 0.25 },     // B5
      { freq: 880, start: 0.56, dur: 0.4, vibrato: true }, // A5 with vibrato
      { freq: 587, start: 1.0, dur: 0.5 },       // D5 descending fade
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      // Vibrato on the third note
      if (note.vibrato) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 5.5;
        lfoGain.gain.value = 12;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(now + note.start);
        lfo.stop(now + note.start + note.dur);
      }

      // Envelope: quick attack, sustain, smooth release
      gain.gain.setValueAtTime(0, now + note.start);
      gain.gain.linearRampToValueAtTime(0.35, now + note.start + 0.03);
      gain.gain.setValueAtTime(0.35, now + note.start + note.dur * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.start + note.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.start);
      osc.stop(now + note.start + note.dur + 0.05);
    }
  } catch {
    // Silently fail if audio isn't available
  }
}
