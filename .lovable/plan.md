

## Wire Loading Station → Delivery Ops

When all items are loaded in the Loading Station, add a "CREATE DELIVERY" button that creates the delivery record and navigates to Delivery Ops.

### Changes to `src/pages/LoadingStation.tsx`

1. Add a "CREATE DELIVERY" button that appears when **all items are loaded** (100% progress)
2. On click, the button:
   - Generates a delivery number (e.g. `DEL-{timestamp}`)
   - Inserts into `deliveries` table: `delivery_number`, `status: "staged"`, `company_id`, `cut_plan_id`
   - Inserts into `delivery_stops` table: `delivery_id`, `company_id`, `stop_sequence: 1`
   - Inserts into `packing_slips` table: `delivery_id`, `company_id`, `cut_plan_id`, `customer_name` (from bundle), `items_json` (from checklist items), `slip_number`, `status: "pending"`
   - Shows success toast and navigates to `/shopfloor/delivery-ops`
3. Add a guard: query `deliveries` by `cut_plan_id` to check if a delivery already exists for this bundle — if so, show "VIEW DELIVERY" instead of "CREATE DELIVERY"

### No database changes needed
All required columns already exist: `deliveries.cut_plan_id`, `packing_slips.cut_plan_id`, `packing_slips.items_json`.

