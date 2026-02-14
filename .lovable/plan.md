

# GitHub-Ready Preparation

## 1. Add `.env` to `.gitignore`

Currently `.env` is **not** listed in `.gitignore`. Add these lines at the end:

```
.env
**/.env
```

## 2. Create `.env.example`

A new file at the project root with the same keys but empty values:

```
VITE_SUPABASE_PROJECT_ID=""
VITE_SUPABASE_PUBLISHABLE_KEY=""
VITE_SUPABASE_URL=""
```

## 3. Update `README.md`

Replace the current boilerplate README with project-specific setup instructions covering:

- Project name and description
- Prerequisites (Node.js, npm)
- Setup steps: clone, `npm install`, copy `.env.example` to `.env` and fill in values, `npm run dev`
- Available scripts (`dev`, `build`, `preview`)
- Tech stack summary (React, Vite, TypeScript, Tailwind, Lovable Cloud)

## Summary

| File | Action |
|------|--------|
| `.gitignore` | Append `.env` and `**/.env` |
| `.env.example` | Create with blank-value keys |
| `README.md` | Rewrite with setup instructions |

No structural changes. No code modifications. Three files touched.

