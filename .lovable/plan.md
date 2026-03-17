## Completed: Upgrade Wan 2.1 → Wan 2.6

### Changes
- **Edge function**: Updated `generate-video` to use `wan2.6-t2v` model with 1080P resolution, 2-15s per clip, prompt extension, and auto-generated audio
- **UI**: Updated model label from "Alibaba Wan 2.1" to "Alibaba Wan 2.6", Balanced mode now uses Wan 2.6 as default provider
- **Duration**: Balanced mode options updated to 5s, 10s, 15s, 30s, 60s (matching Wan 2.6 capabilities)
- **Multi-scene**: Wan max clip duration increased from 8s to 15s, reducing scene count for long videos (30s = 2 clips, 60s = 4 clips)

## Completed: Add All Wan 2.6 Capabilities

### Changes
1. **Image-to-Video (I2V)**
   - Added `wan2.6-i2v` and `wan2.6-i2v-flash` models as new video options
   - New `wanI2vGenerate()` edge function helper — sends `img_url` in input payload
   - Reference image is uploaded to `social-media-assets` storage, public URL passed to DashScope
   - UI enforces ref image upload when I2V model is selected

2. **Custom Audio Sync**
   - Audio file upload button (MP3/WAV) appears when Wan T2V model is selected
   - Audio uploaded to `social-media-assets` storage, URL passed as `audio_url` parameter
   - Only available for T2V (not I2V, which doesn't support audio_url)

3. **Negative Prompts**
   - Toggle "Negative" pill in prompt bar for Wan models
   - Expandable text input for negative prompt (e.g., "blur, text, watermark")
   - Passed as `negative_prompt` to DashScope API for both T2V and I2V

4. **Multi-Scene Fix**
   - Wan max clip duration corrected to 15s (was incorrectly set to 8s)
   - Negative prompt and audio sync passed through to multi-scene generation

## Completed: Fix Broken Logo + Mandatory Watermark + GCE Architecture

### Changes
1. **Brand-assets storage bucket** — Created `brand-assets` bucket with RLS for persistent logo uploads
2. **Logo upload fix** — `ScriptInput.tsx` now uploads logos to Supabase storage instead of using temporary blob URLs
3. **Mandatory watermark** — Removed `logoEnabled` toggle; logo watermark is always active when a logo URL exists
4. **GCE video assembly** — New `gce-video-assembly` edge function orchestrates server-side FFmpeg assembly via preemptible GCE VMs (falls back to browser stitching when GCE credentials are not configured)
5. **FinalPreview.tsx** — Logo toggle replaced with static badge showing watermark status
6. **Export flow** — Tries server-side GCE assembly first, then falls back to browser-side stitching

### GCE Setup Required
To enable server-side video assembly:
- Add `GOOGLE_CLOUD_PROJECT_ID` secret
- Add `GOOGLE_CLOUD_SERVICE_KEY` secret (service account JSON with Compute Engine + Cloud Storage permissions)
- Without these, browser-side assembly is used automatically

## Completed: Pipeline Unified Timeline & Data Quality Patch

### Changes

**Backend — Sync Fixes:**
- `odoo-crm-sync`: Added `planned_revenue` to FIELDS, fixed priority mapping (`0→medium`, `1→low`, `2/3→high`), added `mapOdooPriority()` helper, applied priority on both INSERT and UPDATE paths, revenue fallback to `planned_revenue`
- `odoo-chatter-sync`: Fixed file-to-message linkage to match both integer and string forms of attachment IDs for robust matching
- `_shared/odoo-validation.ts`: Added "Lost"→"lost" and "Prospecting"→"prospecting" to STAGE_MAP

**Frontend — Lead Detail:**
- `LeadDetailDrawer.tsx`: Consolidated 4 tabs (chatter/activities/files/notes) into 2 tabs (Timeline/Details). Timeline shows OdooChatter unified feed. Details shows notes, description, activities, and files together.

**Frontend — Pipeline Board:**
- `Pipeline.tsx`: Added stage group definitions (Sales, Estimation, Quotation, Operations, Terminal) with quick-filter chips. Default view hides Terminal stages to reduce board width. Each chip shows lead count.

**Migration:**
- Added index `idx_lead_files_odoo_id_unlinked` on `lead_files(odoo_id)` for faster file linkage repair
- Added index `idx_lead_files_lead_source` on `lead_files(lead_id, source)` for sync queries

### Known Risks
- Priority re-mapping changes existing lead priorities on next sync (intentional)
- File linkage fix uses both int/string ID matching — monitor results after next sync
- Stage group filter is additive/safe — "Show all" restores full board

### Follow-up
- Run a full Odoo sync to apply priority and revenue fixes to existing data
- Monitor file linkage stats in chatter sync response after deployment
