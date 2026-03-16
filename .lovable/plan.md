

# Fix: Caption Edit Blocked by Database Trigger

## Problem
The database trigger `block_social_publish_without_qa` fires on **every UPDATE** to `social_posts`. If a post already has `status = 'scheduled'` or `'published'`, editing the caption triggers the 20-character validation — even though the user isn't trying to publish, just editing text. This blocks caption edits with the error "Cannot schedule/publish: content must be at least 20 characters".

## Fix

### Database migration — Update trigger function
Modify the trigger to only validate when the status is **transitioning to** `scheduled` or `published` (i.e., `OLD.status` was different), not when it already is one of those statuses and other fields are being updated.

```sql
CREATE OR REPLACE FUNCTION public.block_social_publish_without_qa()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Only validate when status is CHANGING to scheduled/published
  IF NEW.status IN ('scheduled', 'published')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
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

This single change allows editing captions freely on already-published/scheduled posts while still enforcing validation when someone tries to **set** the status to published/scheduled.

