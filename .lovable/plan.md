

# Cutter-02: No Code Fix Needed — Already Correctly Configured

## Current State
- **Cutter-02 machine_capabilities** already restricts to: `20M` (max 8), `25M` (max 6), `30M` (max 4), `35M` (max 1)
- The `useStationData` hook uses a **fail-closed** architecture: it queries `machine_capabilities` for the machine and only shows items matching those bar codes
- The "No items queued" message appears because there are currently **zero `cut_plan_items`** with bar codes 20M/25M/30M/35M in `queued` or `cutting` phase in the database

## Why It Shows Empty
There are no active cut plans with 20M+ items ready to cut. This is correct behavior — once someone creates a cut plan with 20M+ items and queues it, those items will appear on Cutter-02.

## No Changes Required
The filtering enforcement is already in place at two levels:
1. **Database trigger** (`trg_validate_machine_capability`) blocks invalid assignments
2. **Frontend query** (`useStationData`) filters by `machine_capabilities` table

The system is working correctly. To see items on Cutter-02, create a cut plan with 20M+ bar code items and queue it.

