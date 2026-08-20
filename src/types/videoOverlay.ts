export interface VideoOverlay {
  id: string;
  kind: "logo" | "text" | "shape" | "image";
  position: { x: number; y: number }; // percentage 0-100
  size: { w: number; h: number }; // percentage 0-100
  content: string; // URL for logo, text string for text
  opacity: number; // 0-1
  sceneId: string;
  animated?: boolean; // true = apply fade-in + scale animation
  startTime?: number; // seconds within the scene (for timed subtitles)
  endTime?: number;   // seconds within the scene (for timed subtitles)
}
