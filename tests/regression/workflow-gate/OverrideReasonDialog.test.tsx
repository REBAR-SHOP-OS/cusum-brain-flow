/**
 * Regression: OverrideReasonDialog calls workflow_override_transition RPC
 * with the correct args, enforces the 10-char reason gate, and respects
 * the canOverride role check.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

const roleMock = vi.fn();
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => roleMock(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { OverrideReasonDialog } from "@/components/shopfloor/OverrideReasonDialog";

beforeEach(() => {
  rpcMock.mockReset();
  roleMock.mockReset();
});

function renderDialog(overrides: Partial<React.ComponentProps<typeof OverrideReasonDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  render(
    <OverrideReasonDialog
      open
      onOpenChange={onOpenChange}
      entityType="cut_plan_item"
      entityId="item-123"
      fromState="cutting"
      toState="clearance"
      onSuccess={onSuccess}
      {...overrides}
    />,
  );
  return { onOpenChange, onSuccess };
}

describe("OverrideReasonDialog", () => {
  it("renders title, target state, and the workflow_overrides note", () => {
    roleMock.mockReturnValue({ isAdmin: true, isShopSupervisor: false });
    renderDialog();
    expect(screen.getByText(/Supervisor override/i)).toBeInTheDocument();
    expect(screen.getByText(/clearance/)).toBeInTheDocument();
    expect(screen.getByText(/workflow_overrides/)).toBeInTheDocument();
  });

  it("blocks non-supervisor/non-admin users", () => {
    roleMock.mockReturnValue({ isAdmin: false, isShopSupervisor: false });
    renderDialog();
    expect(
      screen.getByText(/Only admin or shop_supervisor may issue an override/i),
    ).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: /Confirm override/i });
    expect(confirm).toBeDisabled();
  });

  it("keeps Confirm disabled until reason ≥ 10 characters", () => {
    roleMock.mockReturnValue({ isAdmin: true, isShopSupervisor: false });
    renderDialog();
    const confirm = screen.getByRole("button", { name: /Confirm override/i });
    expect(confirm).toBeDisabled();

    const textarea = screen.getByPlaceholderText(/Why is this override needed/i);
    fireEvent.change(textarea, { target: { value: "too short" } }); // 9 chars
    expect(confirm).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "valid reason here" } });
    expect(confirm).not.toBeDisabled();
  });

  it("treats whitespace-only reasons as too short", () => {
    roleMock.mockReturnValue({ isShopSupervisor: true, isAdmin: false });
    renderDialog();
    const textarea = screen.getByPlaceholderText(/Why is this override needed/i);
    fireEvent.change(textarea, { target: { value: "          " } });
    expect(screen.getByRole("button", { name: /Confirm override/i })).toBeDisabled();
  });

  it("calls workflow_override_transition with trimmed args on Confirm", async () => {
    roleMock.mockReturnValue({ isAdmin: true, isShopSupervisor: false });
    rpcMock.mockResolvedValue({ error: null });
    const { onOpenChange, onSuccess } = renderDialog();

    const textarea = screen.getByPlaceholderText(/Why is this override needed/i);
    fireEvent.change(textarea, {
      target: { value: "   stuck adjacency from cutting → clearance   " },
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirm override/i }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    expect(rpcMock).toHaveBeenCalledWith("workflow_override_transition", {
      _entity_type: "cut_plan_item",
      _entity_id: "item-123",
      _to_state: "clearance",
      _reason: "stuck adjacency from cutting → clearance",
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not close the dialog when the RPC errors", async () => {
    roleMock.mockReturnValue({ isAdmin: true, isShopSupervisor: false });
    rpcMock.mockResolvedValue({ error: new Error("WORKFLOW_GATE_ADJACENCY: blocked") });
    const { onOpenChange, onSuccess } = renderDialog();

    const textarea = screen.getByPlaceholderText(/Why is this override needed/i);
    fireEvent.change(textarea, { target: { value: "valid reason text here" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm override/i }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("Cancel closes the dialog and never calls the RPC", () => {
    roleMock.mockReturnValue({ isAdmin: true, isShopSupervisor: false });
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
