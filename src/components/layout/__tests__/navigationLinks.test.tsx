import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AppSidebar } from "../AppSidebar";
import { MobileNavV2 } from "../MobileNavV2";
import ShopFloor from "@/pages/ShopFloor";
import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <TooltipProvider>
      <MemoryRouter
        initialEntries={["/home"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {ui}
      </MemoryRouter>
    </TooltipProvider>,
  );
}

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
  },
}));

vi.mock("@/components/shopfloor/MyJobsCard", () => ({
  MyJobsCard: () => <div data-testid="my-jobs-card">My Jobs</div>,
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({
    roles: ["admin"],
    isAdmin: true,
    isCustomer: false,
  }),
}));

vi.mock("@/hooks/useSuperAdmin", () => ({
  useSuperAdmin: () => ({
    isSuperAdmin: false,
  }),
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    unreadCount: 0,
  }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: {
      email: "admin@rebar.shop",
    },
  }),
}));

vi.mock("@/hooks/useCustomerPortalData", () => ({
  useCustomerPortalData: () => ({
    hasAccess: false,
  }),
}));

describe("navigation link fixes", () => {
  it("renders the cutter plan and delivery ops links on the shop floor hub", () => {
    renderWithProviders(<ShopFloor />);

    expect(screen.getByRole("link", { name: /cutter plan/i })).toHaveAttribute("href", "/shopfloor/cutter");
    expect(screen.getByRole("link", { name: /delivery ops/i })).toHaveAttribute("href", "/shopfloor/delivery-ops");
  });

  it("routes sidebar inventory to the canonical inventory page", () => {
    renderWithProviders(<AppSidebar />);

    expect(screen.getByRole("link", { name: /inventory/i })).toHaveAttribute("href", "/shopfloor/inventory");
  });

  it("opens the mobile more menu with the canonical social route", () => {
    renderWithProviders(<MobileNavV2 />);

    fireEvent.click(screen.getByRole("button", { name: /more/i }));

    expect(screen.getByRole("link", { name: /social/i })).toHaveAttribute("href", "/social-media-manager");
  });
});
