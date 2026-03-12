

# Add Cost Estimate Before Generation

## Problem
Users click "Generate All Scenes" without knowing the total cost. They should see a cost breakdown before committing.

## Solution
Add a **Cost Estimate Summary** that appears in the StoryboardTimeline header before generation starts, and a **confirmation dialog** when clicking "Generate All Scenes".

### Changes

#### 1. `src/components/ad-director/StoryboardTimeline.tsx`
- Add a cost summary bar showing: number of scenes, estimated total cost (scenes × $0.38 per Wan 2.6 clip), and total duration
- Wrap the "Generate All Scenes" button with an AlertDialog confirmation
- Dialog shows: scene count, cost per scene ($0.38 for Wan T2V / $0.38 for I2V), total estimated cost, total duration
- "Generate" button inside dialog to confirm, "Cancel" to abort

#### 2. `src/components/ad-director/AdDirectorContent.tsx`
- Pass scene cost metadata to StoryboardTimeline (mode per scene → cost per scene)
- Add cost calculation helper: T2V scenes = $0.38, I2V = $0.38, static-card = $0.00

#### 3. Cost Display Details
- Show inline badge in storyboard header: "Est. $1.14 for 3 scenes"
- Confirmation dialog breakdown:
  - Scene 1 (T2V) — Hook — $0.38
  - Scene 2 (T2V) — Problem — $0.38
  - Scene 3 (Card) — CTA — $0.00
  - **Total: $0.76**
- Green "Start Generation" button with cost shown

