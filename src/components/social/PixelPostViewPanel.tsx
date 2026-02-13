import React, { useState } from "react";
import { X, RefreshCw, Wand2, CalendarDays, Copy, Instagram, Facebook, Youtube } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PixelPostData } from "./PixelPostCard";

// TikTok icon (not in lucide)
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.11a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.54z" />
  </svg>
);

interface SocialAccount {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}

interface PixelPostViewPanelProps {
  post: PixelPostData | null;
  onClose: () => void;
}

const PixelPostViewPanel = React.forwardRef<HTMLDivElement, PixelPostViewPanelProps>(
  ({ post, onClose }, ref) => {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedHour, setSelectedHour] = useState("09");
    const [selectedMinute, setSelectedMinute] = useState("00");
    const [accounts, setAccounts] = useState<SocialAccount[]>([
      { id: "instagram", name: "Instagram", icon: Instagram, active: true },
      { id: "facebook", name: "Facebook", icon: Facebook, active: true },
      { id: "youtube", name: "YouTube", icon: Youtube, active: false },
      { id: "tiktok", name: "TikTok", icon: TikTokIcon, active: false },
    ]);

    const toggleAccount = (id: string) => {
      setAccounts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a))
      );
    };

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
    const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"));

    return (
      <Sheet open={!!post} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col overflow-y-auto"
        >
          <div ref={ref} className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Social Media Post</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {post && (
              <div className="flex-1 p-4 space-y-5 overflow-y-auto">
                {/* Image Preview */}
                <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
                  <img
                    src={post.imageUrl}
                    alt="Post preview"
                    className="w-full h-auto object-cover"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate image
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs">
                    <Wand2 className="w-3.5 h-3.5" />
                    AI Edit
                  </Button>
                </div>

                {/* Schedule Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    Schedule
                  </h3>

                  {/* Date Picker */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left text-sm font-normal"
                      >
                        <CalendarDays className="w-4 h-4 mr-2 text-muted-foreground" />
                        {format(selectedDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(d) => d && setSelectedDate(d)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Time Picker */}
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedHour}
                      onChange={(e) => setSelectedHour(e.target.value)}
                      className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {hours.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="text-muted-foreground font-bold">:</span>
                    <select
                      value={selectedMinute}
                      onChange={(e) => setSelectedMinute(e.target.value)}
                      className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {minutes.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Accounts Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Accounts</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {accounts.map((account) => {
                      const Icon = account.icon;
                      return (
                        <button
                          key={account.id}
                          onClick={() => toggleAccount(account.id)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
                            account.active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-muted-foreground hover:border-muted-foreground/50"
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          {account.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-col gap-2 pt-2">
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                    <CalendarDays className="w-3.5 h-3.5" />
                    View in calendar
                  </Button>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                    <Copy className="w-3.5 h-3.5" />
                    Duplicate
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }
);

PixelPostViewPanel.displayName = "PixelPostViewPanel";

export { PixelPostViewPanel };
