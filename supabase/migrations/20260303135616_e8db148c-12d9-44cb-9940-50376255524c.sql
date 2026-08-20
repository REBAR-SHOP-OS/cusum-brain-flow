
-- ============================================================
-- ERP DISCREPANCY FIX: Columns + Triggers + Constraints
-- ============================================================

-- A) ORDERS: add due_date (other lifecycle columns already exist)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- B) DELIVERIES: add order_id FK
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- C) PRODUCTION TASKS: add order_id FK
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- C2) Unique constraint to prevent duplicate production tasks
CREATE UNIQUE INDEX IF NOT EXISTS idx_prod_tasks_dedup
  ON production_tasks(company_id, COALESCE(order_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(mark_number,''), COALESCE(drawing_ref,''), bar_code, COALESCE(cut_length_mm, 0), task_type);

-- D) TIME CLOCK: enforce single open shift per employee
CREATE OR REPLACE FUNCTION public.block_multiple_open_shifts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.clock_out IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.time_clock_entries
      WHERE profile_id = NEW.profile_id AND clock_out IS NULL AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Only one open shift allowed per employee';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_open_shift ON time_clock_entries;
CREATE TRIGGER enforce_single_open_shift
  BEFORE INSERT OR UPDATE ON time_clock_entries
  FOR EACH ROW EXECUTE FUNCTION public.block_multiple_open_shifts();

-- E) SOCIAL POSTS: add qa_status column
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS qa_status TEXT NOT NULL DEFAULT 'needs_review';

-- E2) Block schedule/publish without QA approval + min content length
CREATE OR REPLACE FUNCTION public.block_social_publish_without_qa()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('scheduled', 'published') THEN
    IF NEW.qa_status != 'approved' THEN
      RAISE EXCEPTION 'Cannot schedule/publish: QA status must be approved first';
    END IF;
    IF length(NEW.content) < 20 THEN
      RAISE EXCEPTION 'Cannot schedule/publish: content must be at least 20 characters';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_social_qa ON social_posts;
CREATE TRIGGER enforce_social_qa
  BEFORE INSERT OR UPDATE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION public.block_social_publish_without_qa();
