

## Convert Neel Approval to a Proper Button & Translate All Persian Text to English

### Changes

**`src/components/social/PostReviewPanel.tsx`**

1. **Neel Approval section (lines 568-590)** — Replace all three states with English text and make the "approved" and "awaiting" states look like proper buttons:
   - `neel_approved = true` → Green button style: "Approved by Neel ✅"
   - Current user is neel → Clickable amber button: "Neel Approval" (keep as-is but English)
   - Other users → Disabled/outline button: "Awaiting Neel's Approval"

2. **Toast on approval (line 579)** → `title: "Approved"`, `description: "Post approved by Neel."`

3. **Publish guard toast (line 599)** → `title: "Neel Approval Required"`, `description: "This post must be approved by Neel before publishing."`

4. **Schedule guard toast (line 679)** → `title: "Invalid Time"`, `description: "Cannot schedule in the past. Please select a future time."`

**`src/components/social/SchedulePopover.tsx`**

5. **Past-time toast (line 59)** → `title: "Invalid Time"`, `description: "Cannot schedule in the past. Please select a future time."`

