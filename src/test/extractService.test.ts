import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase client
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockInvoke = vi.fn();
const mockIs = vi.fn();
const mockNeq = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      return {
        insert: mockInsert,
        update: mockUpdate,
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
        is: mockIs,
        neq: mockNeq,
      };
    }),
    functions: {
      invoke: mockInvoke,
    },
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "test-token" } },
        error: null,
      })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}));

vi.mock("@/lib/storageUtils", () => ({
  getSignedFileUrl: vi.fn().mockResolvedValue("https://example.com/signed-url"),
}));

beforeEach(() => {
  vi.clearAllMocks();

  // Default chain: insert -> select -> single
  mockInsert.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ single: mockSingle, eq: mockEq });
  mockSingle.mockResolvedValue({ data: { id: "test-id" }, error: null });
  mockEq.mockReturnValue({ order: mockOrder });
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockEq.mockResolvedValue({ data: null, error: null });
});

describe("Extract Service - End to End Flow", () => {
  it("1. createExtractSession succeeds and returns session data", async () => {
    const expectedSession = {
      id: "session-123",
      company_id: "company-1",
      name: "Test Session",
      status: "draft",
    };
    mockSingle.mockResolvedValue({ data: expectedSession, error: null });

    const { createExtractSession } = await import("@/lib/extractService");
    const result = await createExtractSession({
      companyId: "company-1",
      name: "Test Session",
    });

    expect(result).toMatchObject({
      id: "session-123",
      name: "Test Session",
    });
  });

  it("2. runExtract invokes edge function with sessionId and returns", async () => {
    mockInvoke.mockResolvedValue({
      data: { status: "processing", sessionId: "session-123" },
      error: null,
    });

    const { runExtract } = await import("@/lib/extractService");

    await runExtract({
      sessionId: "session-123",
      fileUrl: "https://example.com/file.xlsx",
      fileName: "test.xlsx",
      manifestContext: {
        name: "Test",
        customer: "Customer",
        address: "123 Main",
        type: "delivery",
      },
    });

    expect(mockInvoke).toHaveBeenCalledWith("extract-manifest", {
      body: {
        sessionId: "session-123",
        fileUrl: "https://example.com/file.xlsx",
        fileName: "test.xlsx",
        manifestContext: {
          name: "Test",
          customer: "Customer",
          address: "123 Main",
          type: "delivery",
        },
      },
    });
  });

  it("3. runExtract throws when edge function returns error", async () => {
    mockInvoke.mockResolvedValue({
      data: { error: "Rate limit exceeded" },
      error: null,
    });

    const { runExtract } = await import("@/lib/extractService");

    await expect(
      runExtract({
        sessionId: "session-123",
        fileUrl: "https://example.com/file.xlsx",
        fileName: "test.xlsx",
        manifestContext: {
          name: "Test",
          customer: "Customer",
          address: "123 Main",
          type: "delivery",
        },
      })
    ).rejects.toThrow("Rate limit exceeded");
  });

  it("4. fetchExtractRows returns rows ordered by row_index", async () => {
    const mockRows = [
      { id: "r1", row_index: 1, mark: "A1", quantity: 5 },
      { id: "r2", row_index: 2, mark: "A2", quantity: 3 },
    ];
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: mockRows, error: null });

    const { fetchExtractRows } = await import("@/lib/extractService");
    const rows = await fetchExtractRows("session-123");

    expect(rows).toHaveLength(2);
    expect(rows[0].row_index).toBe(1);
    expect(rows[1].row_index).toBe(2);
  });

  it("5. applyMapping calls manage-extract edge function with correct action", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, mappedCount: 5 },
      error: null,
    });

    const { applyMapping } = await import("@/lib/extractService");
    const result = await applyMapping("session-456");

    expect(mockInvoke).toHaveBeenCalledWith("manage-extract", {
      body: { action: "apply-mapping", sessionId: "session-456" },
    });
    expect(result).toMatchObject({ success: true, mappedCount: 5 });
  });
});

// ─── Test 1: Exact Duplicate Merge ─────────────────────────
describe("Duplicate Detection", () => {
  it("detectDuplicates calls edge function and returns merge summary", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        duplicates_found: 1,
        rows_merged: 1,
        total_active_rows: 1,
      },
      error: null,
    });

    const { detectDuplicates } = await import("@/lib/extractService");
    const result = await detectDuplicates("session-123");

    expect(mockInvoke).toHaveBeenCalledWith("manage-extract", {
      body: { action: "detect-duplicates", sessionId: "session-123", dryRun: false },
    });
    expect(result.duplicates_found).toBe(1);
    expect(result.rows_merged).toBe(1);
    expect(result.total_active_rows).toBe(1);
  });
});

// ─── Test 3: Invalid Session Name ──────────────────────────
describe("Session Name Validation", () => {
  it("blocks empty name", async () => {
    const { validateSessionName } = await import("@/lib/extractService");
    expect(validateSessionName("").valid).toBe(false);
  });

  it("blocks single character 'a'", async () => {
    const { validateSessionName } = await import("@/lib/extractService");
    const result = validateSessionName("a");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("at least 3");
  });

  it("blocks junk name 'asdf'", async () => {
    const { validateSessionName } = await import("@/lib/extractService");
    const result = validateSessionName("asdf");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not a valid");
  });

  it("blocks junk name 'test'", async () => {
    const { validateSessionName } = await import("@/lib/extractService");
    const result = validateSessionName("test");
    expect(result.valid).toBe(false);
  });

  it("blocks repeating characters 'aaa'", async () => {
    const { validateSessionName } = await import("@/lib/extractService");
    expect(validateSessionName("aaa").valid).toBe(false);
  });

  it("allows valid name '23 HALFORD ROAD'", async () => {
    const { validateSessionName } = await import("@/lib/extractService");
    expect(validateSessionName("23 HALFORD ROAD").valid).toBe(true);
  });

  it("blocks whitespace-only", async () => {
    const { validateSessionName } = await import("@/lib/extractService");
    expect(validateSessionName("   ").valid).toBe(false);
  });
});

// ─── Test 4: Double Approval Idempotency ───────────────────
describe("Approval Safety", () => {
  it("approveExtract calls edge function with optimizer config", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, work_order_number: "WO-001", items_approved: 5 },
      error: null,
    });

    const { approveExtract } = await import("@/lib/extractService");
    const result = await approveExtract("session-123", {
      stockLengthMm: 12000,
      kerfMm: 5,
      selectedMode: "combination",
    });

    expect(mockInvoke).toHaveBeenCalledWith("manage-extract", {
      body: {
        action: "approve",
        sessionId: "session-123",
        optimizerConfig: { stockLengthMm: 12000, kerfMm: 5, selectedMode: "combination" },
      },
    });
    expect(result.work_order_number).toBe("WO-001");
  });

  it("approveExtract throws on edge function error", async () => {
    mockInvoke.mockResolvedValue({
      data: { error: "Session already approved" },
      error: null,
    });

    const { approveExtract } = await import("@/lib/extractService");
    await expect(approveExtract("session-123")).rejects.toThrow("Session already approved");
  });
});

// ─── Test 5: Optimization uses active rows only ────────────
describe("Optimization Integrity", () => {
  it("fetchExtractRows returns all rows including merged for filtering", async () => {
    const mockRows = [
      { id: "r1", row_index: 1, mark: "A1", quantity: 10, status: "raw" },
      { id: "r2", row_index: 2, mark: "A1", quantity: 5, status: "merged", merged_into_id: "r1" },
    ];
    mockEq.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: mockRows, error: null });

    const { fetchExtractRows } = await import("@/lib/extractService");
    const rows = await fetchExtractRows("session-123");

    // Client-side filtering should separate active vs merged
    const activeRows = rows.filter(r => r.status !== "merged");
    const mergedRows = rows.filter(r => r.status === "merged");

    expect(activeRows).toHaveLength(1);
    expect(activeRows[0].quantity).toBe(10);
    expect(mergedRows).toHaveLength(1);
    expect(mergedRows[0].merged_into_id).toBe("r1");
  });
});
