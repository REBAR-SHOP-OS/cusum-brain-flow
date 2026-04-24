# Replace Lovable Logo with rebar.shop Logo

## Why

Windows push notifications (your screenshot) show the Lovable heart icon because `public/sw-push.js` references `/favicon.ico`, and `public/favicon.ico` is still the original Lovable heart. The PNG icons (`favicon.png`, `pwa-icon-192.png`, `pwa-icon-512.png`) are *already* the rebar.shop coin logo, but `favicon.ico` was never regenerated and the service worker uses the `.ico`.

## What gets done

**1. Regenerate `public/favicon.ico`** as a multi-resolution ICO (16/32/48/64/128/256) from `public/brand/rebar-logo.png` using ImageMagick. Replaces the Lovable heart.

**2. Resize `public/pwa-icon-192.png` and `public/pwa-icon-512.png`** to their actual nominal dimensions. Today they are 1024×1024 files mis-named — fixing this gives crisp icons in PWA installers and notification trays.

**3. Resize `public/favicon.png`** to 512×512 (currently 1024×1024) for tab favicon.

**4. Update `public/sw-push.js`** to use `/pwa-icon-192.png` for both `icon` and `badge` fields. Higher-quality PNG renders better in Windows notification toasts than the small ICO frames, and it future-proofs the SW against any further `.ico` regression.

## What does not change

- `index.html` — already references the correct paths (`/favicon.png`, `/pwa-icon-192.png`, `/pwa-icon-512.png`).
- `public/brand/rebar-logo.png` (source).
- All other application code.

## Validation

After regeneration, convert each new file to a preview PNG and visually verify the rebar coin logo appears (not the heart) at all sizes.

## User-side note after deploy

Browsers aggressively cache favicons and service workers. Users may need to:
- Hard-refresh (Ctrl+Shift+R) once for the tab favicon.
- Re-register the service worker (close/reopen browser) before new push notifications pick up the new icon.

## Risk

Very low. Only static asset replacement plus a 2-line change in `sw-push.js`. No application logic touched.
