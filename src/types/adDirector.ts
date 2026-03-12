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
  referenceAssetUrl?: string | null;
  continuityLock: boolean;
  locked: boolean;
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
