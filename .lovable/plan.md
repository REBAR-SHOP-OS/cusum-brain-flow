

## Audit and Fix: Cascade Deletion in Production Queue

### Root Cause
The error **"violates foreign key constraint 'work_orders_project_id_fkey'"** occurs because the deletion code doesn't remove all dependent records before deleting a project. The `work_orders` delete on line 82 may silently fail (no error checking), and several other FK-dependent tables are completely missing from the deletion chain.

### Full FK Dependency Map

**Deleting a Project requires clearing (in order):**

```text
projects
  +-- work_orders (project_id)         -- handled but not error-checked
  +-- project_events (project_id)      -- MISSING
  +-- project_milestones (project_id)  -- MISSING
  +-- project_tasks (project_id)       -- MISSING
  +-- barlists (project_id)
  |     +-- work_orders (barlist_id)   -- handled
  |     +-- barlist_items (barlist_id) -- handled
  |     +-- machine_queue_items (barlist_id) -- MISSING
  |     +-- production_tasks (barlist_id)    -- MISSING
  +-- cut_plans (project_id)
        +-- cut_plan_items (cut_plan_id)
        |     +-- clearance_evidence        -- handled
        |     +-- cut_output_batches        -- MISSING
        |     +-- inventory_reservations    -- MISSING
        |     +-- loading_checklist         -- MISSING
        |     +-- production_tasks          -- MISSING
        +-- deliveries (cut_plan_id)        -- MISSING
        +-- inventory_reservations          -- MISSING
        +-- loading_checklist               -- MISSING
        +-- loading_evidence                -- MISSING
        +-- packing_slips                   -- MISSING
```

**Deleting a Barlist requires clearing:**

```text
barlists
  +-- work_orders (barlist_id)           -- handled
  +-- barlist_items (barlist_id)          -- handled
  +-- machine_queue_items (barlist_id)   -- MISSING
  +-- production_tasks (barlist_id)      -- MISSING
```

**Deleting a Customer requires clearing:**
The current code only deletes `contacts`. Missing: `orders`, `quotes`, `leads`, `communications`, `accounting_mirror`, `client_performance_memory`, `customer_health_scores`, `customer_user_links`, `delivery_stops`, `estimation_projects`, `lead_outcome_memory`, `pickup_orders`, `recurring_transactions`, `tasks`, `vendor_user_links`.

### Solution: Two Changes

#### 1. Database Migration: SET NULL on critical FKs

Instead of trying to delete every dependent record (risky for accounting/financial data), we will use a hybrid approach:
- For production-related child tables that should be cleaned up: delete them in code.
- For customer-level financial/historical tables: SET the FK to NULL so they're preserved as orphan records (safe for accounting).

**SQL Migration:**
```sql
-- Make customer FKs SET NULL on delete for financial/historical tables
-- This preserves financial records when a customer is deleted

ALTER TABLE public.orders DROP CONSTRAINT orders_customer_id_fkey,
  ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.quotes DROP CONSTRAINT quotes_customer_id_fkey,
  ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.leads DROP CONSTRAINT leads_customer_id_fkey,
  ADD CONSTRAINT leads_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.communications DROP CONSTRAINT communications_customer_id_fkey,
  ADD CONSTRAINT communications_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.accounting_mirror DROP CONSTRAINT accounting_mirror_customer_id_fkey,
  ADD CONSTRAINT accounting_mirror_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.recurring_transactions DROP CONSTRAINT recurring_transactions_customer_id_fkey,
  ADD CONSTRAINT recurring_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.tasks DROP CONSTRAINT tasks_customer_id_fkey,
  ADD CONSTRAINT tasks_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.delivery_stops DROP CONSTRAINT delivery_stops_customer_id_fkey,
  ADD CONSTRAINT delivery_stops_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.pickup_orders DROP CONSTRAINT pickup_orders_customer_id_fkey,
  ADD CONSTRAINT pickup_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public.estimation_projects DROP CONSTRAINT estimation_projects_customer_id_fkey,
  ADD CONSTRAINT estimation_projects_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- CASCADE delete for pure child tables that have no independent value
ALTER TABLE public.client_performance_memory DROP CONSTRAINT client_performance_memory_customer_id_fkey,
  ADD CONSTRAINT client_performance_memory_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE public.customer_health_scores DROP CONSTRAINT customer_health_scores_customer_id_fkey,
  ADD CONSTRAINT customer_health_scores_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE public.customer_user_links DROP CONSTRAINT customer_user_links_customer_id_fkey,
  ADD CONSTRAINT customer_user_links_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE public.lead_outcome_memory DROP CONSTRAINT lead_outcome_memory_customer_id_fkey,
  ADD CONSTRAINT lead_outcome_memory_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE public.vendor_user_links DROP CONSTRAINT vendor_user_links_vendor_id_fkey,
  ADD CONSTRAINT vendor_user_links_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES customers(id) ON DELETE CASCADE;

-- Project child tables: CASCADE delete
ALTER TABLE public.project_events DROP CONSTRAINT project_events_project_id_fkey,
  ADD CONSTRAINT project_events_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE public.project_milestones DROP CONSTRAINT project_milestones_project_id_fkey,
  ADD CONSTRAINT project_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE public.project_tasks DROP CONSTRAINT project_tasks_project_id_fkey,
  ADD CONSTRAINT project_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- Work orders: SET NULL for project_id (they may also link via order_id)
ALTER TABLE public.work_orders DROP CONSTRAINT work_orders_project_id_fkey,
  ADD CONSTRAINT work_orders_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
```

#### 2. Frontend Fix: `ProductionQueueView.tsx`

Update the three delete handlers to clear ALL remaining FK dependencies before deleting the parent:

**`handleDeleteBarlist`**: Add deletion of `machine_queue_items` and `production_tasks` referencing the barlist.

**`handleDeleteProject`**: Add deletion of `machine_queue_items`, `production_tasks`, `cut_output_batches`, `inventory_reservations`, `loading_checklist`, `loading_evidence`, `packing_slips`, `deliveries` before deleting cut plan items/plans. Also add error checking on all intermediate deletes.

**`handleDeleteCustomer`**: Simplified since the DB migration handles most customer FKs via SET NULL/CASCADE. Only `contacts` still needs explicit deletion (already done).

### No New RLS Policies Needed
All relevant tables already have DELETE policies (via `ALL` or explicit `DELETE` policies) for admin/workshop roles. The tables using `ALL` policy (like `machine_queue_items`, `production_tasks`, `cut_output_batches`, etc.) already cover DELETE operations.

