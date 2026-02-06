import { useState } from "react";
import { X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatHistoryItem {
  id: string;
  title: string;
  agent: string;
  agentColor: string;
  time: string;
}

interface HistoryGroup {
  label: string;
  items: ChatHistoryItem[];
}

const mockHistory: HistoryGroup[] = [
  {
    label: "Today",
    items: [
      { id: "1", title: "New social media post", agent: "Soshie", agentColor: "bg-pink-500", time: "20 minute" },
      { id: "2", title: "Confirm Consulting Vendo...", agent: "Cal", agentColor: "bg-sky-500", time: "1 hour" },
    ]
  },
  {
    label: "Last 7 days",
    items: [
      { id: "3", title: "Monthly HST/ITC Leakage ...", agent: "Penny", agentColor: "bg-purple-500", time: "4 day" },
    ]
  },
  {
    label: "Last 30 days",
    items: [
      { id: "4", title: "Reviewing external conten...", agent: "Soshie", agentColor: "bg-pink-500", time: "1 week" },
      { id: "5", title: "Full-year Profit & Loss anal...", agent: "Penny", agentColor: "bg-purple-500", time: "1 week" },
      { id: "6", title: "Set Up Social Media Mana...", agent: "Soshie", agentColor: "bg-pink-500", time: "1 week" },
      { id: "7", title: "Social media strategy and ...", agent: "Soshie", agentColor: "bg-pink-500", time: "1 week" },
      { id: "8", title: "Platform-specific social m...", agent: "Soshie", agentColor: "bg-pink-500", time: "1 week" },
      { id: "9", title: "Social media profile optimi...", agent: "Rex", agentColor: "bg-teal-500", time: "2 week" },
      { id: "10", title: "Creating a YouTube video ...", agent: "Soshie", agentColor: "bg-pink-500", time: "2 week" },
      { id: "11", title: "Create Social Media Post", agent: "Soshie", agentColor: "bg-pink-500", time: "2 week" },
    ]
  }
];

export function HistoryPanel({ isOpen, onClose }: HistoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const filteredHistory = mockHistory.map(group => ({
    ...group,
    items: group.items.filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.agent.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(group => group.items.length > 0);

  return (
    <div className="fixed inset-y-0 left-16 w-80 bg-card border-r border-border z-40 flex flex-col shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <h2 className="text-lg font-semibold">History</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-secondary border-0"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {filteredHistory.map((group) => (
            <section key={group.label}>
              <h3 className="text-xs font-medium text-muted-foreground mb-3">{group.label}</h3>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary cursor-pointer transition-colors"
                  >
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0", item.agentColor)}>
                      {item.agent[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
