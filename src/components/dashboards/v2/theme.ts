// Navy Trust palette scoped to Dashboard v2.
// Applied via inline CSS variables on the shell root so it does not affect
// the rest of the app. Values are HSL triplets to match the design system.
export const v2Theme = {
  "--v2-canvas": "219 64% 14%",        // #0f1b3d
  "--v2-panel": "212 53% 25%",         // #1e3a5f
  "--v2-panel-2": "212 45% 30%",       // slightly lighter for nested
  "--v2-border": "212 35% 32%",
  "--v2-accent": "210 47% 43%",        // #3b6fa0
  "--v2-text": "215 27% 92%",          // #e8edf3
  "--v2-text-muted": "215 18% 70%",
  "--v2-ok": "152 60% 45%",
  "--v2-warn": "38 92% 55%",
  "--v2-bad": "8 78% 58%",
} as const;

export const v2StyleVars = v2Theme as unknown as React.CSSProperties;
