// ─── AI Video Director Types ─────────────────────────────────

export interface BrandProfile {
  name: string;
  website: string;
  cta: string;
  tagline: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontStyle: string;
  targetAudience: string;
  referenceAesthetic: string;
}

export type SegmentType =
  | "hook"
  | "problem"
  | "consequence"
  | "solution"
  | "service"
  | "credibility"
  | "urgency"
  | "cta"
  | "closing";

export type GenerationMode =
  | "text-to-video"
  | "image-to-video"
  | "reference-continuation"
  | "static-card"
  | "motion-graphics";

export interface ScriptSegment {
  id: string;
  type: SegmentType;
  label: string;
  text: string;
  startTime: number; // seconds
  endTime: number;
}

// ─── Multi-Model Routing Types ───────────────────────────────

export type AITaskType =
  | "analyze-script"
  | "generate-storyboard"
  | "write-cinematic-prompt"
  | "score-prompt-quality"
  | "improve-prompt"
  | "analyze-reference"
  | "continuity-check"
  | "rewrite-cta"
  | "generate-subtitles"
  | "generate-voiceover"
  | "classify-scene"
  | "quality-review"
  | "optimize-ad";




export type ModelOverrides = Partial<Record<AITaskType, string>>;

export interface PromptQualityScore {
  realism: number;
  specificity: number;
  visualRichness: number;
  continuityStrength: number;
  brandRelevance: number;
  emotionalPersuasion: number;
  cinematicClarity: number;
  overall: number;
  suggestion?: string;
}

export interface SceneIntelligence {
  plannedBy: string;
  promptWrittenBy: string;
  promptScoredBy?: string;
  videoEngine?: string;
}


// ─── Storyboard Scene ────────────────────────────────────────

export interface StoryboardScene {
  id: string;
  segmentId: string;
  objective: string;
  visualStyle: string;
  shotType: string;
  cameraMovement: string;
  environment: string;
  subjectAction: string;
  emotionalTone: string;
  transitionNote: string;
  generationMode: GenerationMode;
  continuityRequirements: string;
  prompt: string;
  voiceover?: string;
  referenceAssetUrl?: string | null;
  continuityLock: boolean;
  locked: boolean;
  sceneIntelligence?: SceneIntelligence;
  promptQuality?: PromptQualityScore;
  /** ID of the scene this scene was split from (set on the right half) */
  splitFromId?: string;
  /** ID of the scene that was created by splitting this scene (set on the left half) */
  splitIntoId?: string;
}

export interface ContinuityProfile {
  subjectDescriptions: string;
  wardrobe: string;
  environment: string;
  timeOfDay: string;
  cameraStyle: string;
  motionRhythm: string;
  colorMood: string;
  lightingType: string;
  objectPlacement: string;
  lastFrameSummary: string;
  nextSceneBridge: string;
}

export type ClipStatus = "idle" | "queued" | "generating" | "completed" | "failed";

export interface ClipOutput {
  sceneId: string;
  status: ClipStatus;
  videoUrl?: string | null;
  error?: string | null;
  progress: number; // 0-100
  generationId?: string | null;
}


export const DEFAULT_BRAND: BrandProfile = {
  name: "Rebar.Shop",
  website: "Rebar.Shop",
  cta: "Upload your drawings and get fast rebar shop drawings delivered.",
  tagline: "Fast, precise rebar detailing when time matters.",
  logoUrl: null,
  primaryColor: "#ef4444",
  secondaryColor: "#1e293b",
  fontStyle: "Modern Sans-Serif",
  targetAudience: "Construction contractors, engineers, general contractors",
  referenceAesthetic: "Premium cinematic industrial B2B",
};

export interface IntroOutroCardSettings {
  headline: string;
  subheadline: string;
  cta: string;
  website: string;
  gradientStart: string;
  gradientEnd: string;
  textColor: string;
  fontFamily: string;
  headlineFontSize: number;
  subFontSize: number;
  logoPosition: "top" | "center" | "bottom";
  logoScale: number;
  showLogo: boolean;
  layout: "centered" | "left" | "logo-top" | "minimal" | "split";
}

export const DEFAULT_CARD_SETTINGS = (brand: BrandProfile): IntroOutroCardSettings => ({
  headline: brand.name || "Brand Name",
  subheadline: brand.tagline || "",
  cta: brand.cta || "",
  website: brand.website || "",
  gradientStart: brand.primaryColor || "#ef4444",
  gradientEnd: brand.secondaryColor || "#1e293b",
  textColor: "#ffffff",
  fontFamily: "sans-serif",
  headlineFontSize: 52,
  subFontSize: 28,
  logoPosition: "top",
  logoScale: 0.8,
  showLogo: true,
  layout: "logo-top",
});

