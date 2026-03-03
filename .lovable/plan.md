

# Fix: Populate Packing Slip Header Fields

## Problem
The packing slip shows "—" for Ship To, Delivery Date, Invoice #, Invoice Date, and Scope because the `LoadingStation.tsx` creation code only sets `customer_name`, `items_json`, `slip_number`, and `status`. It never queries the project/customer data to fill in the remaining fields.

## Data Available
The relationship chain `cut_plans → projects → customers` provides:
- **Ship To**: `customers.shipping_street1`, `shipping_city`, `shipping_province`, `shipping_postal_code`
- **Scope**: `projects.name` (project name as scope)
- **Site Address**: `projects.site_address`

Invoice # and Invoice Date are not available at delivery creation time (they come later from accounting), so those will remain blank — that's correct behavior.

## Changes

### `src/pages/LoadingStation.tsx`
In the `createDelivery` mutation, before inserting the packing slip:

1. **Query project + customer data** from `cut_plans` using the `cutPlanId`:
   ```ts
   const { data: planData } = await supabase
     .from("cut_plans")
     .select("project_name, projects(name, site_address, customers(shipping_street1, shipping_city, shipping_province, shipping_postal_code))")
     .eq("id", selectedBundle.cutPlanId)
     .single();
   ```

2. **Build ship_to** from customer shipping address fields (joined with commas, filtering blanks).

3. **Set scope** to `projects.name`.

4. **Set site_address** to `projects.site_address`.

5. **Set delivery_date** to today's date (`new Date().toISOString().slice(0, 10)`).

6. **Update the packing slip insert** to include `ship_to`, `scope`, `site_address`, and `delivery_date`.

Single file change, no migration needed.

