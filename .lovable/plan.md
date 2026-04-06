

# Remove Persian Text from Vizzy Brain Panel

## Problem
Three locations in `VizzyBrainPanel.tsx` contain Persian text, violating the English-only UI standard.

## Changes

### File: `src/components/vizzy/VizzyBrainPanel.tsx`

1. **Line 319**: Replace `هنوز فعالیتی با این ایجنت ثبت نشده` → `No activity with this agent yet`
2. **Line 530-531**: Replace `بخش کلی` + "General Overview" → just `General Overview`
3. **Line 548-549**: Replace `بخش ایجنت‌ها` + "Agents" → just `Agents`

## Files Changed
- `src/components/vizzy/VizzyBrainPanel.tsx` — 3 text replacements

