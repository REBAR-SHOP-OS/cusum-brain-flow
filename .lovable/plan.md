
# Screenshot Feedback: All @rebar.shop Users + Owner Tracking + Approval Loop

## What Changes

### 1. Show Screenshot Button to ALL @rebar.shop Users (Not Just Internal Check)
**File: `src/components/layout/AppLayout.tsx`**
- Remove the `isInternal` guard so the `<ScreenshotFeedbackButton />` renders for ALL authenticated users with `@rebar.shop` email (currently it already checks for this, but the variable name and comment suggest it was meant to be restricted further). Actually, reviewing the code, `isInternal` already checks for `@rebar.shop` — so it IS shown to all rebar.shop users. The button will remain visible on every page/section since it's rendered in `AppLayout` which wraps all app routes.
- No change needed here — it already works for all `@rebar.shop` users across all pages.

### 2. Track the Submitter as Owner of the Feedback
**File: `src/components/feedback/AnnotationOverlay.tsx`**
- When creating the task, populate `created_by_profile_id` with the submitter's profile ID (currently not set).
- Add `source: "screenshot_feedback"` to the task for easy filtering.
- Include the submitter's name in the task description for visibility.

### 3. Approval Workflow — Notify Owner When Fixed
**File: `src/components/feedback/AnnotationOverlay.tsx`**
- When the task is created, store the owner's `user_id` and `profile_id` in task metadata.
- The task `status` flow: `pending` (new) -> `resolved` (assignee marks fixed) -> task system notifies owner.

**New: Database trigger to notify owner on resolution**
- Create a trigger on the `tasks` table: when `status` changes to `resolved` and `source = 'screenshot_feedback'`, automatically create a notification for the `created_by_profile_id` user asking them to verify the fix.
- If the owner marks it as "not fixed", the task status reverts to `pending` (reschedule). This is handled by allowing the owner to reopen the task from the notification link.

## Technical Details

### A. `AnnotationOverlay.tsx` Changes (lines ~147-165)
- Look up the current user's `profile_id` from the profiles table
- Set `created_by_profile_id` on the inserted task
- Set `source: "screenshot_feedback"` on the task
- Include owner info in task metadata

### B. Database Migration — Notification Trigger
```sql
CREATE OR REPLACE FUNCTION public.notify_feedback_owner_on_resolve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _owner_user_id uuid;
  _task_title text;
BEGIN
  -- Only fire when status changes TO 'resolved' on screenshot feedback tasks
  IF NEW.source = 'screenshot_feedback'
     AND NEW.status = 'resolved'
     AND (OLD.status IS DISTINCT FROM 'resolved')
     AND NEW.created_by_profile_id IS NOT NULL THEN

    SELECT user_id INTO _owner_user_id
    FROM public.profiles WHERE id = NEW.created_by_profile_id;

    IF _owner_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id, type, title, description, priority,
        link_to, agent_name, status, metadata
      ) VALUES (
        _owner_user_id,
        'todo',
        'Verify fix: ' || LEFT(NEW.title, 80),
        'Your screenshot feedback has been marked as resolved. Please verify the fix is correct.',
        'high',
        '/tasks',
        'Feedback',
        'unread',
        jsonb_build_object(
          'task_id', NEW.id,
          'screenshot_url', NEW.attachment_url,
          'action', 'verify_fix'
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_feedback_owner
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_feedback_owner_on_resolve();
```

### C. No UI Changes Needed for Reopening
The owner receives a notification linking to `/tasks`. From there they can see the task and change its status back to `pending` if the fix isn't satisfactory — this resets it for the assignees to address again.

## Summary of Files Changed
- `src/components/feedback/AnnotationOverlay.tsx` — add owner tracking (profile lookup + `created_by_profile_id` + `source`)
- Database migration — trigger to auto-notify the feedback owner when the task is resolved
