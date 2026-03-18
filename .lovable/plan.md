

## Plan: Replace AZIN Avatar Image

### Problem
The current `azin-helper.png` is a screenshot of the dashboard itself (not an actual avatar), causing it to display as a broken/tiny recursive image on the agent card.

### Solution
Generate a new avatar for AZIN using AI image generation (Nano banana pro model) — a cartoon girl with **curly hair**, glasses, same 3D Pixar-like style as all other agent avatars (big eyes, rosy cheeks, warm expression, white/light background, close-up portrait).

### Changes

**File: `src/assets/helpers/azin-helper.png`**
- Generate a new image via `google/gemini-3-pro-image-preview` with prompt matching the existing avatar style: "3D cartoon Pixar-style portrait of a young woman with curly dark hair, big brown eyes, wearing glasses, rosy cheeks, warm smile, light background, same style as corporate mascot character"
- Replace the current broken file with the generated avatar

No code changes needed — the imports already reference this file correctly.

