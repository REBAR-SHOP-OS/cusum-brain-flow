

# Futuristic Architecture Visualization — Audit & Upgrade

## Issues Found

1. **External Services nodes appear disconnected** — edges from Backend layer land at wrong visual positions because the canvas height (1100px) clips the bottom layer
2. **Static feel** — no ambient animation, no grid, no scan-lines, no depth
3. **Edges are plain curves** — no glow trail, no pulse, particles are tiny dots
4. **Nodes are flat rectangles** — no inner glow, no breathing animation, no glassmorphism
5. **No ambient background** — just a static radial gradient, feels dated
6. **Layer labels are plain text** — no visual weight or futuristic styling
7. **Canvas too small** — CANVAS_H=1100 doesn't give enough room for 6 layers at 170px gap

## Plan

### File: `src/pages/Architecture.tsx`

**A. Fix canvas sizing & layout**
- Increase `CANVAS_H` from 1100 to 1300 to ensure External Services layer has room
- Increase `LAYER_GAP` from 170 to 180 for breathing room

**B. Futuristic ambient background**
- Replace static radial gradient with animated CSS grid overlay (subtle dot-matrix pattern)
- Add horizontal scan-line effect using repeating-linear-gradient with low opacity
- Add subtle pulsing radial glow behind each layer cluster

**C. Upgrade edge rendering**
- Add dual-stroke edges: a wide blurred glow stroke underneath + a sharp thin stroke on top
- Replace single particle with 2-3 staggered particles per edge at different speeds
- Add edge hover highlight that pulses
- Increase particle size and add a comet-tail effect using gradient along the path

**D. Upgrade node cards**
- Add glassmorphism: `backdrop-blur-xl`, semi-transparent gradient background
- Add a subtle breathing animation (box-shadow pulse every 3s via CSS)
- Add a thin inner-border glow line at the top of each card
- On hover: scale up + emit radial glow burst

**E. Layer labels upgrade**
- Add a horizontal rule (faint gradient line) spanning from label to right edge
- Style labels with letter-spacing, glow text-shadow matching layer accent

**F. Add ambient elements**
- Floating hexagonal grid pattern in background (SVG, very low opacity)
- Corner vignette darkening for depth
- Add a "SYSTEM ONLINE" status indicator with blinking dot in bottom bar

### File: `src/lib/architectureGraphData.ts`

No changes needed — all nodes and edges are correct.

## Impact
- Only the Architecture page visual layer changes
- No data, routing, or logic changes
- Same nodes, same edges, same interactions — just dramatically more futuristic presentation

