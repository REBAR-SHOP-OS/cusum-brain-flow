

# Delivery & Logistics — Standalone Architecture Package (PDF)

## Objective
Generate a comprehensive 20-file standalone architecture package for the **Delivery & Logistics** module, extracted from the Rebar Shop OS ERP. Output as a single downloadable PDF.

## Data Gathered from Codebase

### Database Tables (12 core tables)
1. `deliveries` — Master delivery record (delivery_number, status, scheduled_date, driver_name, vehicle, cut_plan_id, order_id, driver_profile_id)
2. `delivery_stops` — Per-stop data (address, stop_sequence, pod_photo_url, pod_signature, arrival/departure_time, exception_reason, customer_id, order_id)
3. `delivery_bundles` — Junction: delivery ↔ bundle linkage
4. `packing_slips` — Slip documents (slip_number, customer_name, items_json, ship_to, scope, site_address, delivery_date, invoice_number, invoice_date, signature_path, site_photo_path, status)
5. `loading_checklist` — Per-item loading verification (cut_plan_id, cut_plan_item_id, loaded, loaded_by, loaded_at, photo_path)
6. `loading_evidence` — Photo evidence for loading (photo_url, project_name, captured_by, notes)
7. `pickup_orders` — Customer collection orders (customer_id, site_address, bundle_count, status, signature_data, authorized_by, authorized_at)
8. `pickup_order_items` — Items in pickup orders (mark_number, description, verified)
9. **Supporting:** `customers`, `companies`, `profiles`, `user_roles`, `orders`, `activity_events`

### Frontend Routes (6 routes)
1. `/shopfloor/loading` — Loading Station (bundle checklist + photo evidence)
2. `/shopfloor/pickup` — Pickup Station (customer collection + signature + packing slip)
3. `/shopfloor/delivery-ops` — Delivery Operations (dispatch scheduling, bulk delete)
4. `/shopfloor/delivery/:stopId` — Delivery Terminal (driver drop-off proof: checklist, photo, signature, packing slip print)
5. `/deliveries` — Deliveries list (referenced in routing)
6. Customer Portal delivery view (embedded)

### Components (10+ components)
- `src/components/delivery/PackingSlipPreview.tsx` — Packing slip overlay with PDF/signature/email
- `src/components/delivery/SignaturePad.tsx` — Digital signature capture
- `src/components/dispatch/ReadyBundleList.tsx` — Bundle selection grid
- `src/components/shopfloor/PickupVerification.tsx` — Pickup item verification
- `src/components/shopfloor/SignaturePad.tsx` — Alternate signature pad

### Hooks (4 hooks)
- `usePickupOrders` + `usePickupOrderItems` — Pickup CRUD + realtime
- `useLoadingChecklist` — Loading checklist CRUD + photo upload
- `useCompletedBundles` — Bundles ready for dispatch (pickupOnly filter)
- `useCustomerPortalData` — Customer-facing delivery tracking

### Business Logic
- **Delivery status flow:** pending → staged → scheduled → in-transit → delivered
- **Pickup status flow:** pending → ready → released → collected
- **Hard gate:** Delivery deletion blocked unless status = "pending" (DB trigger: `block_delivery_delete_unless_pending`)
- **Scheduling gate:** driver_name + vehicle + scheduled_date all required to move to "scheduled"
- **Signature storage:** Uploaded to `clearance-photos` bucket, path stored in DB
- **Packing slip creation:** Triggered from Loading/Pickup stations with 4-step invoice resolution chain (cut_plan_items → work_orders → barlists → extract_sessions → orders fallback)
- **POD (Proof of Delivery):** Photo + signature captured at delivery stop, stored in blob storage
- **Realtime:** Subscriptions on `pickup_orders` and `pickup_order_items` with company scoping
- **Bulk operations:** Multi-select delete on DeliveryOps with cascading cleanup (packing_slips → delivery_stops → status reset → delete)

## Approach
1. Write Python/reportlab script with all 20 files populated from real codebase data
2. QA output visually
3. Deliver as downloadable artifact

## Output
`/mnt/documents/Delivery-Logistics-Standalone-Architecture.pdf`

