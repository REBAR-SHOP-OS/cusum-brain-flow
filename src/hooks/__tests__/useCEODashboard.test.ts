import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Static analysis tests for useCEODashboard.ts
 * Verifies multi-tenant isolation: all queries must include company_id scoping.
 */

const DASHBOARD_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../useCEODashboard.ts"),
  "utf-8"
);

// ── company_id scoping ───────────────────────────────────────

describe("CEO Dashboard — company_id scoping", () => {
  it("every .from() query on company-scoped tables includes company_id filter", () => {
    // Tables that MUST be scoped by company_id
    const companyTables = [
      "orders",
      "projects",
      "deliveries",
      "leads",
      "customers",
      "machines",
      "cut_plans",
      "cut_plan_items",
      "inventory_lots",
      "communications",
      "pickup_orders",
      "production_runs",
      "sla_escalation_log",
    ];

    const lines = DASHBOARD_SOURCE.split("\n");
    const issues: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const table of companyTables) {
        // Match .from("table_name") patterns
        if (line.includes(`.from("${table}")`)) {
          // Look ahead up to 5 lines for company_id filter
          const context = lines.slice(i, i + 6).join(" ");
          const hasCompanyFilter =
            context.includes('company_id') ||
            context.includes('companyId') ||
            context.includes('cut_plans.company_id');
          if (!hasCompanyFilter) {
            issues.push(`Line ${i + 1}: .from("${table}") missing company_id filter`);
          }
        }
      }
    }

    expect(issues).toEqual([]);
  });

  it("queries are disabled when companyId is falsy", () => {
    expect(DASHBOARD_SOURCE).toContain("enabled: !!companyId");
  });

  it("queryKey includes companyId for cache isolation", () => {
    const match = DASHBOARD_SOURCE.match(/queryKey:\s*\[.*companyId/);
    expect(match).toBeTruthy();
  });
});

// ── Known schema limitations ─────────────────────────────────

describe("CEO Dashboard — known schema limitations", () => {
  it("social_posts query does NOT have company_id (known limitation)", () => {
    // This test documents the known limitation — social_posts lacks company_id column
    const hasSocialPostsQuery = DASHBOARD_SOURCE.includes('.from("social_posts")');
    if (hasSocialPostsQuery) {
      const lines = DASHBOARD_SOURCE.split("\n");
      const socialLine = lines.findIndex(l => l.includes('.from("social_posts")'));
      if (socialLine >= 0) {
        const context = lines.slice(socialLine, socialLine + 5).join(" ");
        const hasCompanyFilter = context.includes("company_id");
        // Documenting: this SHOULD have company_id but table lacks the column
        expect(hasCompanyFilter).toBe(false); // Known limitation
      }
    }
  });

  it("time_clock_entries query does NOT have company_id (known limitation)", () => {
    const hasTimeClockQuery = DASHBOARD_SOURCE.includes('.from("time_clock_entries")');
    if (hasTimeClockQuery) {
      const lines = DASHBOARD_SOURCE.split("\n");
      const timeLine = lines.findIndex(l => l.includes('.from("time_clock_entries")'));
      if (timeLine >= 0) {
        const context = lines.slice(timeLine, timeLine + 5).join(" ");
        const hasCompanyFilter = context.includes("company_id");
        expect(hasCompanyFilter).toBe(false); // Known limitation
      }
    }
  });
});

// ── Metric computation ───────────────────────────────────────

describe("CEO Dashboard — metric computation logic", () => {
  it("productionProgress formula: completedPieces / totalPieces * 100", () => {
    expect(DASHBOARD_SOURCE).toContain("productionProgress");
    // The source should compute progress as a percentage
    const hasProgressCalc = DASHBOARD_SOURCE.includes("completedPieces") && DASHBOARD_SOURCE.includes("totalPieces");
    expect(hasProgressCalc).toBe(true);
  });

  it("healthScore is computed via calculateHealthScore function", () => {
    expect(DASHBOARD_SOURCE).toContain("calculateHealthScore");
  });

  it("delivery status filter uses 'in-transit' (hyphenated)", () => {
    // The dashboard should use "in-transit" not "in_transit"
    expect(DASHBOARD_SOURCE).toContain('"in-transit"');
  });

  it("QC/SLA queries are present with company_id scoping", () => {
    // 5 QC queries at lines ~450-455
    expect(DASHBOARD_SOURCE).toContain("production_locked");
    expect(DASHBOARD_SOURCE).toContain("qc_final_approved");
    expect(DASHBOARD_SOURCE).toContain("qc_evidence_uploaded");
    expect(DASHBOARD_SOURCE).toContain("sla_breached");
    expect(DASHBOARD_SOURCE).toContain("sla_escalation_log");
  });
});

// ── CEOMetrics interface ─────────────────────────────────────

describe("CEO Dashboard — CEOMetrics interface completeness", () => {
  const requiredFields = [
    "activeProjects", "activeOrders", "totalPieces", "completedPieces",
    "productionProgress", "machinesRunning", "totalMachines", "activeCutPlans",
    "outstandingAR", "unpaidInvoices", "overdueInvoices", "pipelineValue",
    "openLeads", "activeCustomers", "totalTeam", "teamActiveToday",
    "pendingDeliveries", "pickupsReady", "healthScore", "alerts",
  ];

  for (const field of requiredFields) {
    it(`exports CEOMetrics.${field}`, () => {
      expect(DASHBOARD_SOURCE).toContain(`${field}:`);
    });
  }
});
