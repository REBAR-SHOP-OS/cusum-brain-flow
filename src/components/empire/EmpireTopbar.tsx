import { LayoutGrid, Search, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function EmpireTopbar() {
  const { user } = useAuth();
  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "SA";

  return (
    <header className="h-14 border-b border-black/30 bg-[#35E6E6] text-black">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2 font-semibold">
          <LayoutGrid className="h-5 w-5" />
          <span>Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2">
            <Search className="h-4 w-4 opacity-80" />
            <input
              className="w-[260px] bg-transparent text-sm outline-none placeholder:text-black/60"
              placeholder="Search..."
            />
          </div>
          <button className="rounded-xl p-2 hover:bg-black/10 transition" title="Notifications">
            <Bell className="h-5 w-5" />
          </button>
          <div className="h-9 w-9 rounded-full bg-black/15 flex items-center justify-center font-bold text-sm">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
