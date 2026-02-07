/**
 * Foreman Playbook — Edge Case Detection & Resolution
 *
 * Deterministic rules for known shop floor edge cases.
 * Each entry maps an edge case ID to detection logic and resolution steps.
 */

export interface PlaybookEntry {
  id: string;
  module: string;
  title: string;
  detection: string;
  resolution: string[];
  severity: "info" | "warn" | "critical";
}

export const FOREMAN_PLAYBOOK: PlaybookEntry[] = [
  // ── CUT ──
  {
    id: "early_bar_removal",
    module: "cut",
    title: "Early bar removal",
    detection: "Operator removed bar before all pieces were cut from it.",
    resolution: [
      "Record partial output for the bar.",
      "Return remaining length as remnant if ≥300mm.",
      "Scrap if <300mm.",
      "Log actual pieces produced.",
    ],
    severity: "warn",
  },
  {
    id: "extra_bars_loaded",
    module: "cut",
    title: "Extra bars loaded beyond needed",
    detection: "Bars loaded exceeds remaining bars needed for this mark.",
    resolution: [
      "Excess cut pieces become surplus — tag for next job using same bar/length.",
      "If no upcoming job, store as WIP.",
      "Do NOT scrap good pieces.",
    ],
    severity: "info",
  },
  {
    id: "wrong_stock_length",
    module: "cut",
    title: "Wrong stock length selected",
    detection: "Selected stock yields fewer pieces/bar than the plan expects.",
    resolution: [
      "Switch to the correct stock length (check 6M / 12M / 18M).",
      "If correct stock unavailable, recalculate pieces_per_bar.",
      "Update the cut plan item if pieces_per_bar must change.",
    ],
    severity: "warn",
  },
  {
    id: "remnant_substitution",
    module: "cut",
    title: "Remnant available as substitute",
    detection: "A remnant exists that is long enough for this cut.",
    resolution: [
      "Use remnant first to reduce waste.",
      "Verify remnant length ≥ cut_length_mm.",
      "Consume from remnant source instead of new lot.",
    ],
    severity: "info",
  },
  {
    id: "shortage_mid_run",
    module: "cut",
    title: "Stock shortage during run",
    detection: "Available inventory < bars needed to finish this mark.",
    resolution: [
      "Cut what you can with available stock.",
      "Record partial completion.",
      "Notify purchasing of shortage.",
      "Check floor stock and remnant bins.",
    ],
    severity: "critical",
  },
  {
    id: "machine_down_reroute",
    module: "cut",
    title: "Machine down — reroute needed",
    detection: "Machine status is 'down'.",
    resolution: [
      "Identify alternate cutter with matching capability.",
      "Reassign the cut plan to the new machine.",
      "Log the reroute event.",
    ],
    severity: "critical",
  },

  // ── BEND ──
  {
    id: "missing_shape_code",
    module: "bend",
    title: "Missing ASA shape code",
    detection: "Bend item has no asa_shape_code assigned.",
    resolution: [
      "Do NOT proceed without a shape code.",
      "Return to planning for shape assignment.",
      "Check the original barlist for the correct code.",
    ],
    severity: "critical",
  },
  {
    id: "setup_mismatch",
    module: "bend",
    title: "Bar size exceeds bender capacity",
    detection: "Bar code not in machine_capabilities for this bender.",
    resolution: [
      "Reroute to a bender rated for this bar size.",
      "Check the capability registry for alternatives.",
      "Do NOT force-bend — risk of machine damage.",
    ],
    severity: "critical",
  },
  {
    id: "wrong_bar_fed",
    module: "bend",
    title: "Wrong bar size fed to bender",
    detection: "Operator loaded a different bar size than specified.",
    resolution: [
      "Remove the incorrect bar immediately.",
      "Verify bar markings match the cut plan item.",
      "If mislabeled, quarantine and report.",
    ],
    severity: "critical",
  },
  {
    id: "wip_missing",
    module: "bend",
    title: "No WIP available for bending",
    detection: "Zero cut output batches available for this bar code.",
    resolution: [
      "Check cutter progress — cutting may be behind.",
      "Wait for cut output before proceeding.",
      "Do NOT use raw stock directly in bender.",
    ],
    severity: "warn",
  },

  // ── INVENTORY ──
  {
    id: "floor_stock_usage",
    module: "inventory",
    title: "Floor stock available",
    detection: "Floor stock exists for this bar code near this machine.",
    resolution: [
      "Use floor stock before pulling from warehouse lots.",
      "Update floor_stock qty after consumption.",
      "Verify length matches requirement.",
    ],
    severity: "info",
  },
  {
    id: "remnant_suggestion",
    module: "inventory",
    title: "Remnant bin has usable material",
    detection: "Remnant with sufficient length exists in inventory_lots.",
    resolution: [
      "Pull remnant first to minimize waste.",
      "Record consumption against remnant source.",
    ],
    severity: "info",
  },
  {
    id: "partial_po_receive",
    module: "inventory",
    title: "Partial PO received",
    detection: "Purchase order status is 'partial'.",
    resolution: [
      "Book received qty into inventory_lots.",
      "Update PO line items with received counts.",
      "Remaining qty stays on order.",
    ],
    severity: "info",
  },
  {
    id: "reservation_timeout",
    module: "inventory",
    title: "Stale reservation detected",
    detection: "Reservation older than 48 hours without consumption.",
    resolution: [
      "Release the reservation to free stock.",
      "Notify the plan owner.",
      "Re-reserve when operator is ready.",
    ],
    severity: "warn",
  },

  // ── QUEUE ──
  {
    id: "queue_conflict_409",
    module: "queue",
    title: "Queue conflict (409)",
    detection: "Attempt to queue an item that already exists in an active queue.",
    resolution: [
      "Check existing queue for duplicates.",
      "Remove the duplicate or cancel the conflicting entry.",
      "Retry the queue operation.",
    ],
    severity: "warn",
  },
  {
    id: "duplicate_task",
    module: "queue",
    title: "Duplicate task detected",
    detection: "Same mark + bar_code + cut_length already in queue.",
    resolution: [
      "Verify this is not a legitimate separate order.",
      "If duplicate, remove one entry.",
      "If separate order, add distinguishing mark number.",
    ],
    severity: "warn",
  },
  {
    id: "run_already_active",
    module: "queue",
    title: "Run already active on this machine",
    detection: "Machine status is 'running' when trying to start a new run.",
    resolution: [
      "Complete or pause the current run first.",
      "Cannot start a second run on the same machine.",
      "Wait for current run to finish.",
    ],
    severity: "critical",
  },
];

export function getPlaybookEntry(edgeCaseId: string): PlaybookEntry | undefined {
  return FOREMAN_PLAYBOOK.find(e => e.id === edgeCaseId);
}

export function getPlaybookForModule(module: string): PlaybookEntry[] {
  return FOREMAN_PLAYBOOK.filter(e => e.module === module);
}
