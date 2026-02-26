import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase client
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockInvoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      return {
        insert: mockInsert,
        update: mockUpdate,
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
      };
    }),
    functions: {
      invoke: mockInvoke,
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

  it("2. runExtract throws when extract_rows insert fails (RLS error)", async () => {
    // Mock the functions.invoke to return items
    mockInvoke.mockResolvedValue({
      data: {
        items: [{ item: "1", quantity: 5, size: "10M" }],
        summary: { total_items: 1 },
      },
      error: null,
    });

    // First call: update session to "extracting" - succeeds
    // Second call: insert rows - FAILS with RLS error
    const updateEq = vi.fn().mockResolvedValue({ data: null, error: null });
    mockUpdate.mockReturnValue({ eq: updateEq });

    mockInsert.mockResolvedValue({
      error: { message: "new row violates row-level security policy" },
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
    ).rejects.toThrow("Failed to save rows");
  });

  it("3. runExtract throws when session status update fails", async () => {
    // Mock the functions.invoke to return items
    mockInvoke.mockResolvedValue({
      data: {
        items: [{ item: "1", quantity: 5, size: "10M" }],
        summary: { total_items: 1 },
      },
      error: null,
    });

    // First update call (extracting) succeeds
    const updateEqFirst = vi.fn().mockResolvedValue({ data: null, error: null });
    // Insert rows succeeds
    mockInsert.mockResolvedValue({ error: null });
    // Second update call (extracted) fails
    const updateEqSecond = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    let updateCallCount = 0;
    mockUpdate.mockImplementation(() => ({
      eq: () => {
        updateCallCount++;
        if (updateCallCount === 1) return Promise.resolve({ data: null, error: null });
        return Promise.resolve({ data: null, error: { message: "permission denied" } });
      },
    }));

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
    ).rejects.toThrow("Failed to update session");
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
