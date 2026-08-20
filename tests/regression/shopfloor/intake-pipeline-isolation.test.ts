// @vitest-environment node
/**
 * Regression: intake pipeline isolation.
 *
 * Every pipeline table must carry intake_id (= barlists.id) + project_id so
 * each uploaded barlist flows end-to-end without bleeding into another intake
 * for the same customer.
 *
 * Schema check only — verifies the columns exist and that the auto-stamp
 * triggers are installed. Behavioural tests run live against the DB via
 * psql in CI.
 *
 * Rule: mem://architecture/intake-pipeline-isolation
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

function readAllMigrations(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(resolve(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

const PIPELINE_TABLES = [
  "cut_plan_items",
  "bundles",
  "loading_checklist",
  "packing_slips",
  "pickup_orders",
  "pickup_order_items",
  "deliveries",
  "delivery_stops",
  "delivery_bundles",
  "clearance_evidence",
];

const REQUIRED_TRIGGERS = [
  "trg_stamp_intake_cut_plan_items",
  "trg_stamp_intake_clearance_evidence",
  "trg_stamp_intake_loading_checklist",
  "trg_stamp_intake_packing_slips",
  "trg_stamp_intake_deliveries",
  "trg_stamp_intake_delivery_stops",
  "trg_stamp_intake_delivery_bundles",
  "trg_stamp_intake_pickup_order_items",
  "trg_stamp_intake_bundles",
];

describe("intake pipeline isolation — schema", () => {
  const sql = readAllMigrations();

  for (const t of PIPELINE_TABLES) {
    it(`${t} has intake_id column declared in a migration`, () => {
      const re = new RegExp(
        `ALTER TABLE public\\.${t}[\\s\\S]*?ADD COLUMN IF NOT EXISTS intake_id`,
        "i",
      );
      expect(sql).toMatch(re);
    });
    it(`${t} has project_id column declared in a migration`, () => {
      const re = new RegExp(
        `ALTER TABLE public\\.${t}[\\s\\S]*?ADD COLUMN IF NOT EXISTS project_id`,
        "i",
      );
      expect(sql).toMatch(re);
    });
  }

  for (const trg of REQUIRED_TRIGGERS) {
    it(`trigger ${trg} is created`, () => {
      expect(sql).toMatch(new RegExp(`CREATE TRIGGER ${trg}\\b`));
    });
  }
});

describe("intake pipeline isolation — client filters", () => {
  const filesToCheck = [
    "src/hooks/useReadyToShip.ts",
    "src/hooks/useBundles.ts",
    "src/hooks/useClearanceArchive.ts",
    "src/components/shopfloor/MaterialFlowDiagram.tsx",
    "src/pages/DeliveryPipeline.tsx",
  ];
  for (const rel of filesToCheck) {
    it(`${rel} consumes useIntake() and applies intake_id filter`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(src, `${rel} must import useIntake`).toMatch(
        /from\s+["']@\/contexts\/IntakeContext["']/,
      );
      expect(src, `${rel} must reference intake_id in a query`).toMatch(
        /intake_id/,
      );
    });
  }
});
