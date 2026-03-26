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

export interface ModelRoute {
  taskType: AITaskType;
  preferredModel: string;
  fallbackModel: string;
  qualityThreshold: number;
  retryStrategy: "fallback" | "retry-same" | "skip";
}

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

export const AVAILABLE_MODELS = [
  // GPT
  { id: "openai/gpt-5", label: "GPT-5", category: "planning" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini", category: "copy" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano", category: "classification" },
  { id: "openai/gpt-5.2", label: "GPT-5.2", category: "planning" },
  // Google
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", category: "vision" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", category: "evaluation" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", category: "classification" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", category: "vision" },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", category: "evaluation" },
  { id: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image", category: "vision" },
  { id: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image", category: "vision" },
  { id: "google/gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash Image", category: "evaluation" },
] as const;

// Provider philosophy: GPT=planning/creative, Google=vision/eval, Alibaba=video (external)
export const DEFAULT_MODEL_ROUTES: Record<string, { preferred: string; fallback: string; provider: string }> = {
  "Script & Planning (GPT)":   { preferred: "openai/gpt-5",           fallback: "google/gemini-2.5-pro",   provider: "OpenAI" },
  "Creative Writing (GPT)":    { preferred: "openai/gpt-5",           fallback: "google/gemini-2.5-pro",   provider: "OpenAI" },
  "Vision & Continuity (Google)": { preferred: "google/gemini-2.5-pro", fallback: "openai/gpt-5",          provider: "Google" },
  "Evaluation (Google)":       { preferred: "google/gemini-2.5-flash", fallback: "openai/gpt-5-mini",      provider: "Google" },
  "Copy & Voiceover (GPT)":   { preferred: "openai/gpt-5-mini",      fallback: "google/gemini-2.5-flash", provider: "OpenAI" },
};

export const TASK_CATEGORY_MAP: Record<string, AITaskType[]> = {
  "Script & Planning (GPT)":      ["analyze-script", "generate-storyboard"],
  "Creative Writing (GPT)":       ["write-cinematic-prompt", "improve-prompt", "optimize-ad"],
  "Vision & Continuity (Google)": ["analyze-reference", "continuity-check"],
  "Evaluation (Google)":          ["score-prompt-quality", "quality-review", "classify-scene"],
  "Copy & Voiceover (GPT)":      ["rewrite-cta", "generate-subtitles", "generate-voiceover"],
};

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

export interface AdProject {
  id: string;
  name: string;
  brand: BrandProfile;
  rawScript: string;
  segments: ScriptSegment[];
  storyboard: StoryboardScene[];
  continuity: ContinuityProfile | null;
  clips: ClipOutput[];
  finalVideoUrl: string | null;
  subtitlesEnabled: boolean;
  logoEnabled: boolean;
  endCardEnabled: boolean;
  musicMood: string;
  narratorStyle: string;
  status: "draft" | "analyzed" | "generating" | "completed";
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

export const DEMO_SCRIPT = `30-Second Ad Script — Rebar.Shop

0:00–0:04 — Hook
One missing shop drawing can shut down an entire construction site.

0:04–0:09 — Problem
Crews sit idle. Schedules slip. And delays can cost thousands in penalties.

0:09–0:16 — Solution
Rebar.Shop delivers fast, accurate rebar shop drawings to keep your project moving.

0:16–0:21 — Service
We detail foundations, walls, slabs, beams, columns, and full rebar packages — delivered in 48 hours or less.

0:21–0:25 — Credibility
Our expert detailers work 24/7 across all time zones, using advanced detailing software to ensure flawless results.

0:25–0:30 — Call to Action
Visit Rebar.Shop, upload your drawings, and get your shop drawings delivered fast.

Closing Tagline:
Rebar.Shop — Fast, precise rebar detailing when time matters.`;
