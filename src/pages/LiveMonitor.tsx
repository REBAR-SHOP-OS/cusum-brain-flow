import { ScrollArea } from "@/components/ui/scroll-area";
import { LiveMonitorView } from "@/components/office/LiveMonitorView";

export default function LiveMonitor() {
  return (
    <ScrollArea className="h-full">
      <LiveMonitorView />
    </ScrollArea>
  );
}
