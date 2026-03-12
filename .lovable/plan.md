

## Completed: Upgrade Wan 2.1 → Wan 2.6

### Changes
- **Edge function**: Updated `generate-video` to use `wan2.6-t2v` model with 1080P resolution, 2-15s per clip, prompt extension, and auto-generated audio
- **UI**: Updated model label from "Alibaba Wan 2.1" to "Alibaba Wan 2.6", Balanced mode now uses Wan 2.6 as default provider
- **Duration**: Balanced mode options updated to 5s, 10s, 15s, 30s, 60s (matching Wan 2.6 capabilities)
- **Multi-scene**: Wan max clip duration increased from 8s to 15s, reducing scene count for long videos (30s = 2 clips, 60s = 4 clips)
