
# Rename "Website" to "Job Site" Across ERP

A label-only rename throughout the ERP interface. No routes, file names, or backend logic changes — just user-facing text.

## Changes

| File | What Changes |
|------|-------------|
| `src/components/layout/AppSidebar.tsx` | Sidebar nav label: "Website" → "Job Site" |
| `src/hooks/useActiveModule.ts` | Add `/website` route entry with module name "Job Site" (currently missing) |
| `src/pages/WebsiteManager.tsx` | iframe title: "Website Preview" → "Job Site Preview" |
| `src/components/website/WebsiteChat.tsx` | Header: "AI Website Editor" → "AI Job Site Editor"; placeholder: "edit your website" → "edit your job site" |
| `src/components/integrations/AutomationsSection.tsx` | Automation card name: "Website Manager" → "Job Site Manager"; description updated |
| `src/components/agent/agentConfigs.ts` | Webbuilder placeholder: "website updates" → "job site updates"; capabilities label updated |
| `src/components/agent/agentSuggestionsData.ts` | Suggestion text: "website" → "job site" where it refers to rebar.shop |

## What Stays the Same

- Route stays `/website` (no URL break)
- File names stay as-is (`WebsiteManager.tsx`, `WebsiteChat.tsx`, etc.)
- Edge function names stay (`website-chat`, `website-speed-audit`, etc.)
- Internal variable/interface names unchanged
- Tour step IDs unchanged (`nav-website`)

## Technical Details

All changes are string literal replacements in ~7 files. No logic, routing, or database changes required.
