# Fix: "Zone update failed — column 'payload' of relation 'activity_events' does not exist"

## Root cause

When an operator picks a Storage Zone on a Clearance card, the update to `clearance_evidence.storage_zone` fires the trigger `public.log_clearance_zone_assignment()`. That function inserts into `public.activity_events` using a column called `payload`, but the table's JSONB column is actually named `metadata`. Every zone assignment therefore aborts with the Postgres error shown in the toast, and no zone is saved.

No frontend/edge code references `activity_events`, so this is purely a DB-side fix.

## Change

One migration that replaces the trigger function with the correct column name. No table changes, no policy changes, no data migration.

```sql
CREATE OR REPLACE FUNCTION public.log_clearance_zone_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
BEGIN
  IF NEW.storage_zone IS DISTINCT FROM COALESCE(OLD.storage_zone, NULL)
     AND NEW.storage_zone IS NOT NULL THEN
    SELECT cp.company_id INTO _company_id
      FROM public.cut_plan_items ci
      JOIN public.cut_plans cp ON cp.id = ci.cut_plan_id
     WHERE ci.id = NEW.cut_plan_item_id
     LIMIT 1;

    INSERT INTO public.activity_events (
      company_id, event_type, entity_type, entity_id, actor_id, metadata
    ) VALUES (
      _company_id,
      'audit',
      'clearance_evidence',
      NEW.id,
      auth.uid(),
      jsonb_build_object(
        'action', 'storage_zone_assigned',
        'cut_plan_item_id', NEW.cut_plan_item_id,
        'previous_zone', OLD.storage_zone,
        'new_zone', NEW.storage_zone
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
```

## Regression test

Add `tests/regression/shopfloor/clearance-zone-trigger-column.test.ts` that greps the migration files to assert no `log_clearance_zone_assignment` definition references `payload`, so this typo cannot return.

## Verification

1. Reload `/shopfloor/clearance`, pick a Storage Zone on any pending card → no error toast, zone persists.
2. `select metadata from public.activity_events where event_type='audit' and entity_type='clearance_evidence' order by created_at desc limit 1;` shows the `storage_zone_assigned` payload.
3. `vitest tests/regression/shopfloor/clearance-zone-trigger-column.test.ts` passes.

## Out of scope

No changes to other `log_*` triggers, RLS, or the clearance UI — those are working and unaffected.
