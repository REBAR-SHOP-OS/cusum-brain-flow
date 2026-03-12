

# Fix: Background Music Too Loud vs Voiceover

## Problem
The background music competes with the voiceover. Current values:
- **Export (videoStitch.ts)**: `baseMusicVol = 0.3`, `duckedMusicVol = max(0.15, base*0.5)` → music at 0.15 when voice plays. Voice gain = 1.0.
- The ducked volume of 0.15 is still too high relative to voiceover, especially with dynamic/loud music tracks.

## Solution
Adjust audio levels for a professional broadcast mix where voiceover is clearly dominant:

### Changes in `src/lib/videoStitch.ts`

1. **Lower base music volume**: `0.3` → `0.15` (music is ambient, not competing)
2. **Lower ducked music volume**: `0.15` → `0.05` (barely audible behind voice)
3. **Boost voiceover gain**: `1.0` → `1.4` (voice is the star)
4. **Softer compressor threshold**: `-6dB` → `-3dB` to handle the boosted voice cleanly

### Changes in `src/components/ad-director/AdDirectorContent.tsx`

5. **Default musicVolume passed to stitch**: `0.3` → `0.15`

### Summary of new levels
| Track | Before | After |
|-------|--------|-------|
| Voice gain | 1.0 | 1.4 |
| Music base | 0.3 | 0.15 |
| Music ducked (during voice) | 0.15 | 0.05 |

This follows broadcast standards where voice sits ~12-15dB above background music.

