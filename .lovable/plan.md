

# Replace Regenerate Icon with Send Icon

## Change
In `src/components/ad-director/AdDirectorContent.tsx` line 601, replace the `RefreshCw` icon with `Send` — a standard "submit prompt" icon.

### File: `src/components/ad-director/AdDirectorContent.tsx`
- Add `Send` to the lucide-react import
- Line 601: Change `<RefreshCw className="w-3.5 h-3.5" />` → `<Send className="w-3.5 h-3.5" />`

Single line change, no logic affected.

