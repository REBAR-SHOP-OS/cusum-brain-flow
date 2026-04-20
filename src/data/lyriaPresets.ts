import { Zap, Coffee, Crown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type VocalsMode = "instrumental" | "vocals_en" | "vocals_fa";

export interface LyriaPreset {
  id: string;
  label: string;
  icon: LucideIcon;
  genre: string;
  mood: string;
  instruments: string;
  vocals: VocalsMode;
  lyricTheme: string;
  bpmHint: string;
}

export const LYRIA_PRESETS: LyriaPreset[] = [
  {
    id: "upbeat-pop",
    label: "Upbeat Pop-Electronic",
    icon: Zap,
    genre: "pop-electronic",
    mood: "energetic, uplifting, motivational",
    instruments: "modern synthesizers, punchy drum beat, sidechain bass",
    vocals: "vocals_en",
    lyricTheme: "starting a new adventure and reaching success",
    bpmHint: "120 BPM",
  },
  {
    id: "lofi-chill",
    label: "Lo-Fi Chill",
    icon: Coffee,
    genre: "lo-fi hip hop",
    mood: "calm, nostalgic, relaxing",
    instruments: "warm acoustic guitar melody, vinyl crackle, soft drum beat",
    vocals: "instrumental",
    lyricTheme: "",
    bpmHint: "70 BPM",
  },
  {
    id: "cinematic-epic",
    label: "Cinematic Epic",
    icon: Crown,
    genre: "orchestral cinematic",
    mood: "epic, triumphant, powerful",
    instruments: "soft strings opening, building brass, large percussion drums",
    vocals: "instrumental",
    lyricTheme: "",
    bpmHint: "90 BPM",
  },
];

export function buildLyriaPrompt(opts: {
  duration: number;
  genre: string;
  mood: string;
  instruments: string;
  vocals: VocalsMode;
  lyricTheme?: string;
  bpmHint?: string;
}): string {
  const { duration, genre, mood, instruments, vocals, lyricTheme, bpmHint } = opts;

  let vocalsClause = "Fully instrumental, no vocals.";
  if (vocals === "vocals_en") {
    vocalsClause = `Include realistic vocals in English singing about: ${lyricTheme || "the main theme"}.`;
  } else if (vocals === "vocals_fa") {
    vocalsClause = `Include realistic vocals in Persian (Farsi) singing about: ${lyricTheme || "the main theme"}.`;
  }

  const tempo = bpmHint ? ` at ${bpmHint}` : "";
  return `Generate a ${duration}s ${genre} track${tempo}. Mood: ${mood}. Instruments: ${instruments}. ${vocalsClause}`;
}
