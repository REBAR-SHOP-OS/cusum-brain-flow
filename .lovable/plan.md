

# Re-attach TSDC Emails to Their Parent Project

## What Went Wrong

The 5 "RFQ-TSDC" email leads were archived as junk, but they're actually internal team communications (Behnam and Saurabh emailing Sattar) about the existing won project **S02523, RFQ-TSDC** (STRUCTCON LTD). They shouldn't be standalone leads OR archived — they should be activity entries on the parent project's timeline.

## Mapping

| Archived Lead | Email Date | From | Parent Project |
|---|---|---|---|
| S01277 (480b93ed) | Jan 28 | Behnam -> Sattar | S02523 (2a648b5e) |
| S01276 (99097728) | Jan 28 | Saurabh -> Sattar | S02523 (2a648b5e) |
| S01274 (5c8e31fd) | Feb 2 | Behnam -> Sattar | S02523 (2a648b5e) |
| S01273 (e4cbaf99) | Feb 3 | Behnam -> Sattar | S02523 (2a648b5e) |
| S01272 (e56798f8) | Feb 3 | Saurabh -> Sattar | S02523 (2a648b5e) |

## Changes

### 1. Convert archived leads into lead_activities on the parent project

Insert 5 rows into `lead_activities` table:
- `lead_id` = `2a648b5e-c384-4e0f-9de6-ea5dcd00b6c2` (S02523)
- `activity_type` = `email`
- `title` = original email subject (RFQ-TSDC)
- `description` = the notes field from each archived lead (contains from/to/date/AI reason)
- `created_at` = the original email received date (from the notes field)
- `metadata` = `{ "migrated_from_lead_id": "<original_id>", "source": "internal_email" }`

### 2. Delete the 5 orphan lead records

After the activities are created, delete the 5 archived leads so they don't clutter any view. The data is preserved as timeline activities on the correct project.

## Technical Details

### SQL Operations (via data tool, not migration -- this is data, not schema)

**Step 1 -- Insert activities:**
```sql
INSERT INTO lead_activities (lead_id, company_id, activity_type, title, description, created_at, metadata)
VALUES
  ('2a648b5e-...', '<company_id>', 'email', 'RFQ-TSDC', 'From: Behnam ... Jan 28', '2026-01-28T19:48:06+00:00', '{"migrated_from_lead_id":"480b93ed-..."}'),
  -- ... 4 more rows
;
```

**Step 2 -- Delete archived orphan leads:**
```sql
DELETE FROM leads WHERE id IN ('480b93ed-...', '99097728-...', '5c8e31fd-...', 'e4cbaf99-...', 'e56798f8-...');
```

### Result
- The parent project **S02523, RFQ-TSDC** (Won) gains 5 email activity entries in its timeline
- No orphan TSDC leads remain anywhere in the pipeline
- The "New" column stays clean
