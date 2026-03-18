

## Analysis: No Crash Found

The bug report references two files that **do not exist** in this project:
- `src/pages/OfficePage.tsx` — the actual file is `src/pages/OfficePortal.tsx`
- `src/components/BarList.tsx` — no such component exists

After thorough investigation:

1. **`OfficePortal.tsx`** already handles loading via `roleLoading` with a Skeleton fallback
2. **All data hooks** (`useProjects`, `useBarlists`, `useCutPlans`, `useExtractSessions`) default to empty arrays `[]` — no `.map()` on `undefined` is possible
3. **Console logs** show no errors
4. **The screenshot** shows the office page rendering correctly (stuck on "Extracting" state, not crashed)

### Conclusion
The `/office` page is **not crashing**. The bug report appears to be auto-generated with incorrect file names. No code changes are needed.

If you are experiencing an actual crash, please share the exact error from the browser console (right-click → Inspect → Console tab) so I can pinpoint the real issue.

