

## Remove Delivery and Driver Features

This plan removes all delivery/driver pages, components, hooks, navigation entries, and route definitions from the application.

### Files to Delete (11 files)
- `src/pages/Deliveries.tsx`
- `src/pages/DriverDashboard.tsx`
- `src/pages/DriverDropoff.tsx`
- `src/components/delivery/DeliveryPackingSlip.tsx`
- `src/components/delivery/DeliveryTerminal.tsx`
- `src/components/delivery/PODCaptureDialog.tsx`
- `src/components/delivery/PackingSlipTypeSelector.tsx`
- `src/components/delivery/PhotoPackingSlip.tsx`
- `src/components/delivery/SignatureModal.tsx`
- `src/components/delivery/StopIssueDialog.tsx`
- `src/components/customer-portal/CustomerDeliveryTracker.tsx`
- `src/hooks/useDeliveryActions.ts`
- `src/lib/deliveryTransitions.ts`
- `src/hooks/__tests__/deliveryStatus.test.ts`
- `src/components/pipeline/gates/DeliveryGateModal.tsx`

### Files to Edit

1. **`src/App.tsx`** — Remove imports for `Deliveries`, `DriverDashboard`, `DriverDropoff` and their 3 route definitions (`/deliveries`, `/driver`, `/driver/dropoff/:stopId`)

2. **`src/components/layout/AppSidebar.tsx`** — Remove "Deliveries" and "Driver" entries from the Logistics section and the operations nav

3. **`src/components/layout/Sidebar.tsx`** — Remove "Deliveries" from `operationsNav`

4. **`src/components/layout/MobileNav.tsx`** — Remove "Deliveries" entry

5. **`src/components/layout/MobileNavV2.tsx`** — Remove "Driver" from bottom nav and "Deliveries" from the more menu

6. **`src/components/layout/CommandBar.tsx`** — Remove "Deliveries" command entry

7. **`src/pages/ShopFloor.tsx`** — Remove the "DELIVERY" hub card from the grid (keep Loading Station and Pickup Station as they serve production/dispatch purposes independent of delivery tracking)

8. **`src/pages/Pipeline.tsx`** — Remove `DeliveryGateModal` import and its two JSX instances

9. **`src/pages/CustomerPortal.tsx`** — Remove the deliveries tab, `CustomerDeliveryTracker` import, and the deliveries summary card

10. **`src/pages/LoadingStation.tsx`** — Remove `useDeliveryActions` import and the "Create Delivery" button/logic; the loading checklist verification still works standalone for production QC

11. **`src/pages/PickupStation.tsx`** — Remove `DeliveryPackingSlip` and `PhotoPackingSlip` imports; replace with inline or simplified packing slip display

12. **`src/pages/LiveChat.tsx`** — Remove `update_delivery_status` from the tool labels map

### Notes
- Database tables (`deliveries`, `delivery_stops`, `packing_slips`) are left untouched — no data is deleted
- The Loading Station and Pickup Station pages remain functional for production verification purposes; only delivery-creation actions are removed from them
- Edge functions like `stripe-qb-webhook` are unaffected

