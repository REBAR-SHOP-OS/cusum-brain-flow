import { useState } from "react";
import { useProfiles } from "@/hooks/useProfiles";
import { useTimeClock } from "@/hooks/useTimeClock";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare,
  ArrowLeft,
  Crown,
  Briefcase,
  HardHat,
  Truck,
  Send,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const deptConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  admin: { label: "Owner", icon: Crown, color: "text-amber-500" },
  office: { label: "Office", icon: Briefcase, color: "text-blue-500" },
  workshop: { label: "Workshop", icon: HardHat, color: "text-orange-500" },
  field: { label: "Field", icon: Truck, color: "text-green-500" },
};

type DeptFilter = "all" | "admin" | "office" | "workshop" | "field";

export default function TeamHub() {
  const { profiles } = useProfiles();
  const { allEntries } = useTimeClock();
  const [filter, setFilter] = useState<DeptFilter>("all");
  const [announcement, setAnnouncement] = useState("");

  const activeProfiles = profiles.filter((p) => p.is_active !== false);

  // Build online status from time clock
  const onlineSet = new Set<string>();
  for (const entry of allEntries) {
    if (!entry.clock_out) onlineSet.add(entry.profile_id);
  }

  const filtered = filter === "all"
    ? activeProfiles
    : activeProfiles.filter((p) => p.department === filter);

  const onlineCount = activeProfiles.filter((p) => onlineSet.has(p.id)).length;

  const handleSendAnnouncement = () => {
    if (!announcement.trim()) return;
    toast.success("Announcement sent to team");
    setAnnouncement("");
  };

  return (
    <div className="relative flex flex-col items-center min-h-screen bg-background overflow-hidden">
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-purple-500/8 blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full max-w-4xl px-6 pt-8 pb-4">
        <Link
          to="/shop-floor"
          className="inline-flex items-center gap-2 text-xs tracking-widest text-muted-foreground hover:text-foreground transition-colors uppercase mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Command Hub
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <MessageSquare className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black italic text-foreground tracking-tight">TEAM HUB</h1>
            <p className="text-xs tracking-widest text-muted-foreground uppercase">
              {onlineCount} of {activeProfiles.length} members active
            </p>
          </div>
        </div>
      </header>

      {/* Quick Announcement */}
      <div className="relative z-10 w-full max-w-4xl px-6 py-3">
        <Card className="bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-2">
              Team Announcement
            </p>
            <div className="flex gap-2">
              <Textarea
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="Send a message to all team members..."
                className="min-h-[44px] max-h-24 resize-none"
                rows={1}
              />
              <Button
                size="icon"
                className="shrink-0 h-11 w-11"
                onClick={handleSendAnnouncement}
                disabled={!announcement.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Filters */}
      <div className="relative z-10 w-full max-w-4xl px-6 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { id: "all" as DeptFilter, label: "All", count: activeProfiles.length },
            { id: "admin" as DeptFilter, label: "Admin", count: activeProfiles.filter((p) => p.department === "admin").length },
            { id: "office" as DeptFilter, label: "Office", count: activeProfiles.filter((p) => p.department === "office").length },
            { id: "workshop" as DeptFilter, label: "Workshop", count: activeProfiles.filter((p) => p.department === "workshop").length },
            { id: "field" as DeptFilter, label: "Field", count: activeProfiles.filter((p) => p.department === "field").length },
          ]).map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={filter === f.id ? "default" : "outline"}
              className="text-xs gap-1.5 h-8"
              onClick={() => setFilter(f.id)}
            >
              {f.id !== "all" && (() => {
                const Icon = deptConfig[f.id]?.icon || Users;
                return <Icon className="w-3.5 h-3.5" />;
              })()}
              {f.label}
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                {f.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Team Members */}
      <div className="relative z-10 w-full max-w-4xl px-6 py-3 flex-1">
        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((profile) => {
              const isOnline = onlineSet.has(profile.id);
              const dept = deptConfig[profile.department || "office"] || deptConfig.office;
              const DeptIcon = dept.icon;

              return (
                <Card
                  key={profile.id}
                  className={cn(
                    "transition-all hover:scale-[1.02]",
                    isOnline && "border-green-500/30"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={profile.avatar_url || ""} />
                          <AvatarFallback className="bg-muted text-foreground text-sm font-bold">
                            {getInitials(profile.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card",
                            isOnline ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{profile.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {profile.title || profile.email || "Team Member"}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant="secondary"
                            className={cn("text-[10px] gap-1", dept.color)}
                          >
                            <DeptIcon className="w-3 h-3" />
                            {dept.label}
                          </Badge>
                          {isOnline && (
                            <Badge className="text-[10px] bg-green-500/15 text-green-500 border-green-500/30">
                              Online
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
