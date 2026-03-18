

## Plan: Fix All Edge Functions and Eliminate Mock Data in SEO Pages

### Root Cause
The `config.toml` file only lists **13 out of ~160 edge functions**. All missing functions (including `ai-generic` used by AI PR, AI Visibility, Content, and Local SEO pages) fail from the browser because the Supabase gateway enforces JWT verification by default. The project's architecture uses `verify_jwt = false` in config.toml and handles auth internally via `requireAuth()`.

The `ai-generic` function itself works perfectly (tested and returned "Hello!") -- it's purely a gateway config issue.

### Step 1: Add ALL Edge Functions to `config.toml`

Add every function from `supabase/functions/` to `config.toml` with `verify_jwt = false`, matching the project's established pattern. This is ~150 missing entries. This single change will fix:
- **AI PR** "Generate PR Ideas" button
- **AI Visibility** "Run AI Visibility Audit" button
- **Content** "Generate Plan" button
- **Local SEO** "Run Local SEO Audit" button
- And every other edge function call across the entire app

### Step 2: Audit SEO Pages for Mock/Placeholder Data

The SEO sub-pages (AI PR, AI Visibility, Content, Local) currently show placeholder dashes ("--") in their stat cards (PR Opportunities, Brand Mentions, LLM Citations, etc.) with text like "Monitoring not yet active". These are **not mock data** -- they're empty states for features that depend on external monitoring services not yet connected. The AI generation buttons are the real functionality and will work once config.toml is fixed.

No mock data needs to be removed -- the pages are correctly showing empty states for unconnected features, and real AI generation for the actionable buttons.

### Files to Modify
| File | Change |
|------|--------|
| `supabase/config.toml` | Add all ~150 missing function entries with `verify_jwt = false` |

### Technical Detail
Every function directory under `supabase/functions/` (excluding `_shared/`) will get a `[functions.<name>]` block with `verify_jwt = false`.

