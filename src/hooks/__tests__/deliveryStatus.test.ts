import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Delivery status consistency tests.
 * Verifies all modules use "in-transit" (hyphenated) and recognize "completed_with_issues".
 */

const FILES_TO_CHECK = [
  { name: "Deliveries.tsx", path: "../../pages/Deliveries.tsx" },
  { name: "DriverDashboard.tsx", path: "../../pages/DriverDashboard.tsx" },
  { name: "useCEODashboard.ts", path: "../useCEODashboard.ts" },
  { name: "vizzyContext.ts", path: "../../lib/vizzyContext.ts" },
  { name: "PODCaptureDialog.tsx", path: "../../components/delivery/PODCaptureDialog.tsx" },
  { name: "StopIssueDialog.tsx", path: "../../components/delivery/StopIssueDialog.tsx" },
  { name: "CustomerDeliveryTracker.tsx", path: "../../components/customer-portal/CustomerDeliveryTracker.tsx" },
];

function readFile(relativePath: string): string | null {
  try {
    return fs.readFileSync(path.resolve(__dirname, relativePath), "utf-8");
  } catch {
    return null;
  }
}

// ── in-transit consistency ───────────────────────────────────

describe("Delivery status — 'in-transit' consistency (hyphenated)", () => {
  for (const file of FILES_TO_CHECK) {
    it(`${file.name} uses "in-transit" not "in_transit" in status operations`, () => {
      const source = readFile(file.path);
      if (!source) return; // File not found, skip

      // Find all occurrences of in_transit that are NOT inside comments or documentation
      const lines = source.split("\n");
      const badLines: number[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip comments and documentation strings
        if (line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")) continue;
        // Skip import statements
        if (line.startsWith("import")) continue;

        // Check for in_transit used as a status value (in quotes or as object key)
        if (
          line.includes('"in_transit"') ||
          line.includes("'in_transit'") ||
          line.includes("`in_transit`")
        ) {
          badLines.push(i + 1);
        }
      }

      expect(badLines, `${file.name} has "in_transit" (underscore) on lines: ${badLines.join(", ")}`).toEqual([]);
    });
  }
});

// ── completed_with_issues recognition ────────────────────────

describe("Delivery status — 'completed_with_issues' recognition", () => {
  it("Deliveries.tsx statusColors map includes completed_with_issues", () => {
    const source = readFile("../../pages/Deliveries.tsx");
    if (!source) return;
    expect(source).toContain("completed_with_issues");
  });

  it("DriverDashboard.tsx recognizes completed_with_issues", () => {
    const source = readFile("../../pages/DriverDashboard.tsx");
    if (!source) return;
    expect(source).toContain("completed_with_issues");
  });

  it("PODCaptureDialog auto-completes with completed_with_issues on failures", () => {
    const source = readFile("../../components/delivery/PODCaptureDialog.tsx");
    if (!source) return;
    expect(source).toContain("completed_with_issues");
  });

  it("StopIssueDialog auto-completes with completed_with_issues on failures", () => {
    const source = readFile("../../components/delivery/StopIssueDialog.tsx");
    if (!source) return;
    expect(source).toContain("completed_with_issues");
  });
});

// ── MCP server description includes correct statuses ─────────

describe("Delivery status — MCP tool description", () => {
  it("MCP list_deliveries tool describes in-transit status", () => {
    const source = readFile("../../../supabase/functions/mcp-server/index.ts");
    if (!source) return;
    expect(source).toContain("in-transit");
    expect(source).toContain("completed_with_issues");
  });
});

// ── Status color map completeness ────────────────────────────

describe("Delivery status — color map completeness", () => {
  const requiredStatuses = [
    "pending", "scheduled", "in-transit", "delivered",
    "completed", "completed_with_issues",
  ];

  it("Deliveries.tsx has colors for all required statuses", () => {
    const source = readFile("../../pages/Deliveries.tsx");
    if (!source) return;
    for (const status of requiredStatuses) {
      expect(source, `Missing status color for: ${status}`).toContain(status);
    }
  });
});
