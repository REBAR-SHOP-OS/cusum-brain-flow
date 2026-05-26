UPDATE public.clearance_evidence ce
SET status='cleared', verified_at=COALESCE(ce.verified_at, now()), notes=COALESCE(ce.notes,'') || ' [Bulk manual clearance]'
FROM public.cut_plan_items cpi
WHERE ce.cut_plan_item_id=cpi.id AND cpi.phase='clearance' AND ce.status<>'cleared';