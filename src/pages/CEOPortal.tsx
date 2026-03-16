import { ScrollArea } from "@/components/ui/scroll-area";
import { LiveMonitorView } from "@/components/office/LiveMonitorView";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Shield } from "lucide-react";

export default function CEOPortal() {
  const { isSuperAdmin } = useSuperAdmin();

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">Only the super admin can access the Live Monitor.</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <LiveMonitorView />
    </ScrollArea>
  );
}
