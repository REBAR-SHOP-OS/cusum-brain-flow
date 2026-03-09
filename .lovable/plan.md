

# Fix 404 on Published URL

## Problem
Visiting `https://cusum-brain-flow.lovable.app/glasses` directly returns a 404 because the hosting server doesn't know to serve `index.html` for all routes. The app uses client-side routing (React Router), so all paths need to fall back to `index.html`.

## Solution
Add a `public/_redirects` file with a catch-all rule. Lovable's hosting uses the same convention as Netlify:

```
/*    /index.html   200
```

This single line tells the server: "For any path that doesn't match a real file, serve `index.html` with a 200 status." React Router then handles the route on the client side.

## Files
- **Create**: `public/_redirects` — one-line SPA fallback rule

After this change, the user needs to **publish** again for it to take effect on the live URL. The preview should already work since Vite handles SPA routing in dev mode.

