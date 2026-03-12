

# Add Detailed Analysis Progress Indicators

## Problem
When analyzing a script, users only see "Analyzing Script..." with a spinner. No feedback on what the system is doing — feels broken on longer waits.

## Solution
Add a multi-step progress indicator that cycles through descriptive status messages during analysis, showing users each phase of the AI pipeline.

### Changes

#### 1. `src/components/ad-director/AdDirectorContent.tsx`
- Add `analysisStatus` state string that updates as analysis progresses
- Before calling the edge function, cycle through status messages on a timer:
  - "Reading your script..."
  - "Identifying hook, problem, and solution..."
  - "Breaking script into timed scenes..."
  - "Generating storyboard with visual styles..."
  - "Building continuity profile..."
  - "Optimizing scene prompts..."
- Pass `analysisStatus` down to `ScriptInput`

#### 2. `src/components/ad-director/ScriptInput.tsx`
- Accept new `analysisStatus?: string` prop
- When `analyzing` is true, replace the button area with a styled progress card showing:
  - Animated spinner
  - Current status message (e.g., "Identifying hook, problem, and solution...")
  - A subtle progress bar or animated dots
  - The card sits below the button to give a "live feed" feel

This gives users clear, descriptive feedback about what the AI is doing at each moment.

