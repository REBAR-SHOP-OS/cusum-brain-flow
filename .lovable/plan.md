

# Enlarge Video Creation Form Area

## Problem
The video creation form (title, image uploads, textarea, toolbar) is constrained to `max-w-2xl` (~672px) with a small 2-row textarea, making the input area feel cramped.

## Changes

| File | Change |
|---|---|
| `src/components/ad-director/AdDirectorContent.tsx` | Change container from `max-w-2xl` to `max-w-4xl` (line 430) |
| `src/components/ad-director/ChatPromptBar.tsx` | 1. Change wrapper from `max-w-2xl` to `max-w-4xl` (line 182). 2. Increase textarea `rows` from `2` to `5` (line 281) for a taller input area |

This widens the entire form from ~672px to ~896px and gives the user a much larger text input area for writing detailed video prompts.

