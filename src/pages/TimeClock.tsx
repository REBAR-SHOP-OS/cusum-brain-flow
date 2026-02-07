import { useTimeClock } from "@/hooks/useTimeClock";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, LogIn, LogOut, ArrowLeft, Timer } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format, differenceInMinutes } from "date-fns";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TimeClock() {
  const { allEntries, activeEntry, loading, clockIn, clockOut, myProfile, profiles } = useTimeClock();

  const now = new Date();

  // Build a status map: profile_id -> latest entry
  const statusMap = new Map<string, { clocked_in: boolean; clock_in: string; clock_out: string | null }>();
  for (const entry of allEntries) {
    const existing = statusMap.get(entry.profile_id);
    if (!existing || new Date(entry.clock_in) > new Date(existing.clock_in)) {
      statusMap.set(entry.profile_id, {
        clocked_in: !entry.clock_out,
        clock_in: entry.clock_in,
        clock_out: entry.clock_out,
      });
    }
  }

  const activeProfiles = profiles.filter((p) => p.is_active !== false);

  return (
    <div className="relative flex flex-col items-center min-h-screen bg-background overflow-hidden">
      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-primary/8 blur-[150px]" />
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
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black italic text-foreground tracking-tight">TIME CLOCK</h1>
            <p className="text-xs tracking-widest text-muted-foreground uppercase">
              {format(now, "EEEE, MMMM d, yyyy")}
            </p>
          </div>
        </div>
      </header>

      {/* My Clock Card */}
      <div className="relative z-10 w-full max-w-4xl px-6 py-4">
        <Card className="border-primary/20 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14">
                  <AvatarImage src={myProfile?.avatar_url || ""} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                    {getInitials(myProfile?.full_name || "ME")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-bold">{myProfile?.full_name || "You"}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {activeEntry ? (
                      <>
                        <Badge className="bg-green-500/15 text-green-500 border-green-500/30">
                          <Timer className="w-3 h-3 mr-1" /> Clocked In
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          since {format(new Date(activeEntry.clock_in), "h:mm a")}
                          {" · "}
                          {formatDuration(differenceInMinutes(now, new Date(activeEntry.clock_in)))}
                        </span>
                      </>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground">
                        Not Clocked In
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {activeEntry ? (
                <Button
                  size="lg"
                  variant="destructive"
                  className="gap-2 text-base font-bold px-8"
                  onClick={clockOut}
                >
                  <LogOut className="w-5 h-5" /> Clock Out
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="gap-2 text-base font-bold px-8 bg-green-600 hover:bg-green-700 text-white"
                  onClick={clockIn}
                >
                  <LogIn className="w-5 h-5" /> Clock In
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Status */}
      <div className="relative z-10 w-full max-w-4xl px-6 py-4 flex-1">
        <h2 className="text-sm font-bold tracking-wider uppercase text-muted-foreground mb-3">
          Team Status Today
        </h2>
        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {loading ? (
              <p className="text-muted-foreground text-sm col-span-2 text-center py-8">Loading...</p>
            ) : (
              activeProfiles.map((profile) => {
                const status = statusMap.get(profile.id);
                const isClockedIn = status?.clocked_in ?? false;
                const clockInTime = status?.clock_in;
                const elapsed = isClockedIn && clockInTime
                  ? differenceInMinutes(now, new Date(clockInTime))
                  : null;

                // Total hours worked today for this profile
                const profileEntries = allEntries.filter((e) => e.profile_id === profile.id);
                const totalMins = profileEntries.reduce((sum, e) => {
                  const end = e.clock_out ? new Date(e.clock_out) : (isClockedIn ? now : new Date(e.clock_in));
                  return sum + differenceInMinutes(end, new Date(e.clock_in));
                }, 0);

                return (
                  <Card
                    key={profile.id}
                    className={cn(
                      "transition-colors",
                      isClockedIn && "border-green-500/30 bg-green-500/5"
                    )}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={profile.avatar_url || ""} />
                          <AvatarFallback className="text-xs font-bold bg-muted text-foreground">
                            {getInitials(profile.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card",
                            isClockedIn ? "bg-green-500" : "bg-muted-foreground/40"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{profile.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {isClockedIn
                            ? `In since ${format(new Date(clockInTime!), "h:mm a")} · ${formatDuration(elapsed!)}`
                            : totalMins > 0
                              ? `Worked ${formatDuration(totalMins)} today`
                              : "Not clocked in"
                          }
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          isClockedIn && "bg-green-500/15 text-green-500"
                        )}
                      >
                        {isClockedIn ? "Active" : totalMins > 0 ? formatDuration(totalMins) : "Off"}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
