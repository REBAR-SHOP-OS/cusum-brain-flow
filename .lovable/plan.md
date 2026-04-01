

# Operations & Shop Floor — Standalone Architecture Package (PDF)

## Objective
Generate a comprehensive 20-file standalone architecture package for the **Operations & Shop Floor** module, extracted from the Rebar Shop OS ERP. Output as a single downloadable PDF.

## Data Gathered from Codebase

### Database Tables (40+ tables)
**Core Production:**
- `machines`, `machine_runs`, `machine_capabilities`, `machine_queue_items`
- `cut_plans`, `cut_plan_items`, `cut_batches`, `cut_output_batches`
- `bend_batches`, `production_tasks`, `production_events`
- `rebar_sizes`, `activity_events`

**Inventory & Material:**
- `inventory_lots`, `inventory_reservations`, `inventory_scrap`
- `floor_stock`, `waste_bank_pieces`
- `purchase_orders`, `purchase_order_lines`
- `inventory_counts`, `inventory_count_items`

**QC & Clearance:**
- `clearance_evidence`

**Dispatch & Delivery:**
- `deliveries`, `delivery_stops`, `delivery_items`
- `pickup_orders`, `pickup_order_items`
- `loading_checklists`

**Camera Intelligence:**
- `camera_events`, `cameras`, `camera_zones`

**Supporting:**
- `companies`, `profiles`, `user_roles`, `work_orders`, `projects`, `customers`, `barlists`

### Frontend Routes (14 routes)
1. `/shop-floor` — Command Hub (hub card navigation)
2. `/shopfloor/station` — Station Dashboard (machine grid + filters)
3. `/shopfloor/station/:machineId` — Station View (cutter/bender controls)
4. `/shopfloor/cutter` — Cutter Planning (cut plan management)
5. `/shopfloor/pool` — Material Pool (staging & flow)
6. `/shopfloor/loading` — Loading Station (bundle checklist + photos)
7. `/shopfloor/pickup` — Pickup Station (customer collection + signature)
8. `/shopfloor/clearance` — Clearance Station (QC evidence + AI validation)
9. `/shopfloor/inventory` — Inventory Counts
10. `/shopfloor/delivery-ops` — Delivery Operations (scheduling + dispatch)
11. `/shopfloor/delivery/:stopId` — Delivery Terminal (drop-off proof)
12. `/shopfloor/camera-intelligence` — Camera AI (vision events)
13. `/admin/waste-bank` — Waste Bank Admin
14. `/admin/bend-queue` — Bend Queue Admin
15. `/admin/bundles` — Bundle Admin
16. `/admin/production-audit` — Production Audit
17. `/live-monitor` — Live Monitor
18. `/print-tags` — Print Tags
19. `/timeclock` — Time Clock

### Components (28+ components in shopfloor/)
- `CutterStationView`, `BenderStationView` — Machine-type-specific station UIs
- `ProductionCard`, `ProductionCardInstructions` — Job card rendering
- `BarSizeGroup` — Groups items by rebar size
- `MachineSelector`, `MachineGroupSection`, `MachineSpecsPanel` — Machine grid
- `StationHeader` — Station identification + pin/unpin
- `QRJobScanner` — QR scan for auto-navigation
- `SignaturePad` — Pickup signature capture
- `InventoryCountView`, `InventoryStatusPanel` — Inventory management
- `SlotTracker` — Production slot tracking
- `TransferMachineDialog` — Move jobs between machines
- `MyJobsCard` — Operator's active jobs
- `ForemanPanel` — Supervisor overview
- `MaterialFlowDiagram` — Visual flow
- `DowntimeAlertBanner` — Stale machine alerts
- `BenderBatchPanel` — Bend queue per machine
- `BendingSchematic`, `AsaShapeDiagram` — Shape visualization
- `CutEngine` — Cut optimization logic
- `ShopFloorProductionQueue`, `WorkOrderQueueSection`, `ActiveProductionHub` — Queue views
- `PickupVerification` — Pickup item verification

### Hooks (20+ hooks)
- `useLiveMonitorData`, `useStationData`, `useCutPlans`, `useCutPlanItems`
- `useProductionQueues`, `useClearanceData`, `useCompletedBundles`
- `useLoadingChecklist`, `usePickupOrders`, `usePickupOrderItems`
- `useWasteBank`, `useBenderBatches`, `useBendBatches`
- `useInventoryData`, `useInventoryCounts`, `useSlotTracker`
- `useTabletPin`, `useForemanBrain`, `useShapeSchematics`
- `useSupabaseWorkOrders`, `useBundles`

### Edge Functions (15+ relevant)
- `manage-machine` (732 lines) — Start/pause/complete/block/unlock runs, cutter routing, capability validation, self-healing recovery, cut_batch creation, waste bank remnant insertion
- `manage-bend` — Bend queue CRUD, bend start/pause/complete/cancel, waste bank reserve/consume/release, delivery-from-bundles
- `smart-dispatch` — AI-scored machine assignment, queue management, task routing
- `manage-inventory` (533 lines) — PO receiving, stock reservation, consumption, remnant creation, inventory adjustments, scrap recording
- `validate-clearance-photo` — AI vision QC (Gemini) for tag/material photo validation
- `log-machine-run` — Machine run event logging
- `camera-events` — External camera event ingestion (API-key auth)
- `camera-ping` — Camera health check
- `shape-vision` — AI shape recognition
- `extract-manifest` — Barlist extraction (feeds cut plans)
- `kiosk-lookup`, `kiosk-punch`, `kiosk-register` — Time clock kiosk
- `timeclock-alerts` — Shift alerts

### Business Logic Highlights
- **Self-healing machine recovery:** Stale runs (>30min), orphaned runs, completed-job auto-clear
- **Cutter routing enforcement:** Cutter-01 = 10M/15M only; Cutter-02 = 20M+ only (403 error)
- **Capability validation:** bar_code + process + max_bars checked against `machine_capabilities`
- **Hard job lock:** Prevents job switching mid-run (403)
- **5s double-tap idempotency:** Prevents duplicate start-run requests
- **Smart dispatch scoring:** idle+50, running+10, blocked-30, down-100, queue_length*-10, setup_match+25
- **Cut batch auto-creation on completion** with variance detection
- **Waste bank remnant insertion** for remnants ≥300mm
- **Supervisor override** (force-unlock) requires admin/shop_supervisor role
- **Phase state machine:** queued → cutting → cut_done → bending → bend_done → clearance → complete
- **Delivery status flow:** pending → staged → scheduled → in-transit → delivered
- **Pickup release with signature capture** (stored in blob storage)
- **AI-powered clearance photo validation** using Gemini vision
- **Inventory deduplication** via `dedupe_key` on activity_events
- **Realtime subscriptions** on all major tables with 500ms debounce

## Approach
1. Write Python/reportlab script to generate structured PDF with all 20 files
2. Populate from real codebase data gathered above
3. QA output visually
4. Deliver as downloadable artifact

## Output
`/mnt/documents/Operations-ShopFloor-Standalone-Architecture.pdf`

