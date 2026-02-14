

# Security Fix: Add .env to .gitignore

## Current State
- `.gitignore` exists but has **no `.env` rules** -- this is the only gap
- `README.md` already contains the security note (line 28)
- `.env.example` is correct with empty-value keys

## Change

### Update `.gitignore`
Append these lines to the **end** of the existing file (after line 22):

```
# Environment files
.env
**/.env
.env.*
!.env.example
```

No other files are touched.

## Files NOT Modified
| File | Reason |
|------|--------|
| `.env` | Kept as-is in workspace |
| `.env.example` | Already correct and tracked |
| `README.md` | Already has security note |
| `index.html`, `src/`, `package.json`, `vite.config.ts` | No structural changes |
| Supabase / Vite config | Not modified |

## Post-Implementation (Manual)
After this change syncs to GitHub, run locally:

```sh
git rm --cached .env
git commit -m "Remove .env from repo and ignore env files"
git push
```

Then rotate your backend credentials since they are exposed in Git history.
