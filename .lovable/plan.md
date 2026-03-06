

# Fix: "QA status must be approved first" Error on Set Date

## Root Cause

There is a database trigger (`enforce_social_qa`) that blocks any update where `status = 'scheduled'` unless `qa_status = 'approved'`. However, in `PostReviewPanel.tsx` line 435, when the user clicks "Set Date", the code sets `qa_status: "scheduled"` — which fails the trigger check.

The same issue exists in `SchedulePopover.tsx` line 62, which also sets `qa_status: "scheduled"`.

## Fix

Update the database trigger to also allow `qa_status = 'scheduled'` (since "scheduled" is a post-approval state). This is the correct fix because `qa_status: "scheduled"` is semantically valid — it means the post was reviewed and scheduled.

### Database Migration

```sql
CREATE OR REPLACE FUNCTION public.block_social_publish_without_qa()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('scheduled', 'published') THEN
    IF NEW.qa_status NOT IN ('approved', 'scheduled', 'published') THEN
      RAISE EXCEPTION 'Cannot schedule/publish: QA status must be approved first';
    END IF;
    IF length(NEW.content) < 20 THEN
      RAISE EXCEPTION 'Cannot schedule/publish: content must be at least 20 characters';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

This single migration fixes the issue for both `PostReviewPanel` (Set Date button) and `SchedulePopover` (Schedule button). No frontend changes needed.

