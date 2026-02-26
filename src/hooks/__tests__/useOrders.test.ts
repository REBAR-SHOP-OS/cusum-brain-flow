import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Static analysis + logic tests for useOrders.ts
 * Verifies company_id scoping, QB payload structure, and query gating.
 */

const ORDERS_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../useOrders.ts"),
  "utf-8"
);

// ── Company ID scoping ───────────────────────────────────────

describe("useOrders — company_id isolation", () => {
  it("orders query is disabled when companyId is falsy", () => {
    expect(ORDERS_SOURCE).toContain("enabled: !!companyId");
  });

  it("orders query filters by company_id", () => {
    expect(ORDERS_SOURCE).toContain('.eq("company_id", companyId!)');
  });

  it("uses useCompanyId hook", () => {
    expect(ORDERS_SOURCE).toContain("useCompanyId");
  });

  it("queryKey includes companyId", () => {
    expect(ORDERS_SOURCE).toContain('"orders", companyId');
  });
});

// ── QuickBooks payload ───────────────────────────────────────

describe("useOrders — sendToQuickBooks payload", () => {
  it("includes companyId in QB invoice request", () => {
    expect(ORDERS_SOURCE).toContain("companyId,");
    // Verify it's inside the body payload for quickbooks-oauth
    const qbSection = ORDERS_SOURCE.substring(
      ORDERS_SOURCE.indexOf("quickbooks-oauth"),
      ORDERS_SOURCE.indexOf("quickbooks-oauth") + 500
    );
    expect(qbSection).toContain("companyId");
  });

  it("sends lineItems with description, amount, quantity", () => {
    expect(ORDERS_SOURCE).toContain("description: i.description");
    expect(ORDERS_SOURCE).toContain("amount: i.unit_price");
    expect(ORDERS_SOURCE).toContain("quantity: i.quantity");
  });

  it("checks for quickbooks_id on customer before invoicing", () => {
    expect(ORDERS_SOURCE).toContain("quickbooks_id");
    expect(ORDERS_SOURCE).toContain("Customer has no QuickBooks ID");
  });

  it("prevents double-invoicing with quickbooks_invoice_id check", () => {
    expect(ORDERS_SOURCE).toContain("quickbooks_invoice_id");
    expect(ORDERS_SOURCE).toContain("already invoiced");
  });

  it("updates order status to 'invoiced' after QB success", () => {
    expect(ORDERS_SOURCE).toContain('status: "invoiced"');
  });
});

// ── Order interface ──────────────────────────────────────────

describe("useOrders — Order interface", () => {
  const requiredFields = [
    "id", "order_number", "customer_id", "company_id",
    "total_amount", "status", "order_date", "required_date",
    "shop_drawing_status", "customer_revision_count",
    "qc_internal_approved_at", "customer_approved_at",
    "production_locked", "pending_change_order",
    "qc_final_approved", "qc_evidence_uploaded",
  ];

  for (const field of requiredFields) {
    it(`Order interface has ${field}`, () => {
      expect(ORDERS_SOURCE).toContain(`${field}:`);
    });
  }
});

// ── Mutation invalidation ────────────────────────────────────

describe("useOrders — cache invalidation", () => {
  it("addItem invalidates order-items and orders", () => {
    expect(ORDERS_SOURCE).toContain('"order-items"');
    expect(ORDERS_SOURCE).toContain('"orders"');
  });

  it("updateOrderStatus invalidates orders cache", () => {
    const statusSection = ORDERS_SOURCE.substring(
      ORDERS_SOURCE.indexOf("updateOrderStatus"),
      ORDERS_SOURCE.indexOf("updateOrderStatus") + 300
    );
    expect(statusSection).toContain("invalidateQueries");
    expect(statusSection).toContain('"orders"');
  });

  it("convertQuote invalidates orders cache", () => {
    const convertSection = ORDERS_SOURCE.substring(
      ORDERS_SOURCE.indexOf("convertQuote"),
      ORDERS_SOURCE.indexOf("convertQuote") + 500
    );
    expect(convertSection).toContain("invalidateQueries");
  });
});

// ── OrderItem interface ──────────────────────────────────────

describe("useOrders — OrderItem interface", () => {
  it("has rebar-specific fields: bar_size, length_mm, shape", () => {
    expect(ORDERS_SOURCE).toContain("bar_size:");
    expect(ORDERS_SOURCE).toContain("length_mm:");
    expect(ORDERS_SOURCE).toContain("shape:");
  });
});
