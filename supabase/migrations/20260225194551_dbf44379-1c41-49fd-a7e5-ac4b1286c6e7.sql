
-- === CUSTOMER FKs: SET NULL for financial/historical tables ===
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey,
  ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_customer_id_fkey,
  ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_customer_id_fkey,
  ADD CONSTRAINT leads_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.communications DROP CONSTRAINT IF EXISTS communications_customer_id_fkey,
  ADD CONSTRAINT communications_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.accounting_mirror DROP CONSTRAINT IF EXISTS accounting_mirror_customer_id_fkey,
  ADD CONSTRAINT accounting_mirror_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.recurring_transactions DROP CONSTRAINT IF EXISTS recurring_transactions_customer_id_fkey,
  ADD CONSTRAINT recurring_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_customer_id_fkey,
  ADD CONSTRAINT tasks_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.delivery_stops DROP CONSTRAINT IF EXISTS delivery_stops_customer_id_fkey,
  ADD CONSTRAINT delivery_stops_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.pickup_orders DROP CONSTRAINT IF EXISTS pickup_orders_customer_id_fkey,
  ADD CONSTRAINT pickup_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.estimation_projects DROP CONSTRAINT IF EXISTS estimation_projects_customer_id_fkey,
  ADD CONSTRAINT estimation_projects_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- === CUSTOMER FKs: CASCADE for pure child tables ===
ALTER TABLE public.client_performance_memory DROP CONSTRAINT IF EXISTS client_performance_memory_customer_id_fkey,
  ADD CONSTRAINT client_performance_memory_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE public.customer_health_scores DROP CONSTRAINT IF EXISTS customer_health_scores_customer_id_fkey,
  ADD CONSTRAINT customer_health_scores_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE public.customer_user_links DROP CONSTRAINT IF EXISTS customer_user_links_customer_id_fkey,
  ADD CONSTRAINT customer_user_links_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE public.lead_outcome_memory DROP CONSTRAINT IF EXISTS lead_outcome_memory_customer_id_fkey,
  ADD CONSTRAINT lead_outcome_memory_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE public.vendor_user_links DROP CONSTRAINT IF EXISTS vendor_user_links_vendor_id_fkey,
  ADD CONSTRAINT vendor_user_links_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES customers(id) ON DELETE CASCADE;

-- === PROJECT FKs: CASCADE for child tables ===
ALTER TABLE public.project_events DROP CONSTRAINT IF EXISTS project_events_project_id_fkey,
  ADD CONSTRAINT project_events_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE public.project_milestones DROP CONSTRAINT IF EXISTS project_milestones_project_id_fkey,
  ADD CONSTRAINT project_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE public.project_tasks DROP CONSTRAINT IF EXISTS project_tasks_project_id_fkey,
  ADD CONSTRAINT project_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- Work orders: SET NULL for project_id
ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_project_id_fkey,
  ADD CONSTRAINT work_orders_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- === BARLIST child tables: CASCADE ===
ALTER TABLE public.machine_queue_items DROP CONSTRAINT IF EXISTS machine_queue_items_barlist_id_fkey,
  ADD CONSTRAINT machine_queue_items_barlist_id_fkey FOREIGN KEY (barlist_id) REFERENCES barlists(id) ON DELETE CASCADE;

ALTER TABLE public.production_tasks DROP CONSTRAINT IF EXISTS production_tasks_barlist_id_fkey,
  ADD CONSTRAINT production_tasks_barlist_id_fkey FOREIGN KEY (barlist_id) REFERENCES barlists(id) ON DELETE CASCADE;

-- === CUT PLAN child tables: CASCADE ===
ALTER TABLE public.cut_plan_items DROP CONSTRAINT IF EXISTS cut_plan_items_cut_plan_id_fkey,
  ADD CONSTRAINT cut_plan_items_cut_plan_id_fkey FOREIGN KEY (cut_plan_id) REFERENCES cut_plans(id) ON DELETE CASCADE;

ALTER TABLE public.clearance_evidence DROP CONSTRAINT IF EXISTS clearance_evidence_cut_plan_item_id_fkey,
  ADD CONSTRAINT clearance_evidence_cut_plan_item_id_fkey FOREIGN KEY (cut_plan_item_id) REFERENCES cut_plan_items(id) ON DELETE CASCADE;

ALTER TABLE public.cut_output_batches DROP CONSTRAINT IF EXISTS cut_output_batches_cut_plan_item_id_fkey,
  ADD CONSTRAINT cut_output_batches_cut_plan_item_id_fkey FOREIGN KEY (cut_plan_item_id) REFERENCES cut_plan_items(id) ON DELETE CASCADE;

ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_cut_plan_id_fkey,
  ADD CONSTRAINT deliveries_cut_plan_id_fkey FOREIGN KEY (cut_plan_id) REFERENCES cut_plans(id) ON DELETE SET NULL;

-- === PROJECT-level child tables: CASCADE ===
ALTER TABLE public.inventory_reservations DROP CONSTRAINT IF EXISTS inventory_reservations_cut_plan_id_fkey,
  ADD CONSTRAINT inventory_reservations_cut_plan_id_fkey FOREIGN KEY (cut_plan_id) REFERENCES cut_plans(id) ON DELETE CASCADE;

ALTER TABLE public.loading_checklist DROP CONSTRAINT IF EXISTS loading_checklist_cut_plan_id_fkey,
  ADD CONSTRAINT loading_checklist_cut_plan_id_fkey FOREIGN KEY (cut_plan_id) REFERENCES cut_plans(id) ON DELETE CASCADE;

ALTER TABLE public.loading_evidence DROP CONSTRAINT IF EXISTS loading_evidence_cut_plan_id_fkey,
  ADD CONSTRAINT loading_evidence_cut_plan_id_fkey FOREIGN KEY (cut_plan_id) REFERENCES cut_plans(id) ON DELETE SET NULL;

ALTER TABLE public.packing_slips DROP CONSTRAINT IF EXISTS packing_slips_cut_plan_id_fkey,
  ADD CONSTRAINT packing_slips_cut_plan_id_fkey FOREIGN KEY (cut_plan_id) REFERENCES cut_plans(id) ON DELETE SET NULL;
