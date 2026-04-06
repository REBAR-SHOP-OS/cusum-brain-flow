import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LeadFormModal } from "../LeadFormModal";

const invalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");

  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: [], isLoading: false })),
    useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
    useQueryClient: vi.fn(() => ({ invalidateQueries })),
  };
});

vi.mock("@/hooks/useCompanyId", () => ({
  useCompanyId: () => ({ companyId: "company-1" }),
}));

vi.mock("@/hooks/useProfiles", () => ({
  useProfiles: () => ({
    profiles: [{ id: "profile-1", full_name: "Jane Doe", is_active: true }],
  }),
}));

vi.mock("@/hooks/useLeadAssignees", () => ({
  useLeadAssignees: () => ({
    byLeadId: {
      "lead-1": [{ profile_id: "profile-1" }],
    },
    addAssignee: { mutate: vi.fn() },
    removeAssignee: { mutate: vi.fn() },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe("LeadFormModal", () => {
  beforeEach(() => {
    invalidateQueries.mockClear();
  });

  it("hydrates edit mode with the selected lead values", async () => {
    const lead = {
      id: "lead-1",
      title: "Rebar package for Tower A",
      description: "Existing description",
      customer_id: "customer-1",
      stage: "qualified",
      probability: 65,
      expected_value: 125000,
      expected_close_date: "2026-04-15",
      source: "Email",
      priority: "high",
      metadata: { lead_type: "opportunity" },
      notes: "Existing notes",
      assigned_to: "profile-1",
      territory: "GTA",
    } as any;

    const { rerender } = render(
      <LeadFormModal open onOpenChange={() => {}} lead={lead} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Title")).toHaveValue("Rebar package for Tower A");
    });

    expect(screen.getByLabelText("Description")).toHaveValue("Existing description");
    expect(screen.getByLabelText("Expected Value ($)")).toHaveValue(125000);
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    rerender(<LeadFormModal open onOpenChange={() => {}} lead={null} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Title")).toHaveValue("");
    });
  });
});
