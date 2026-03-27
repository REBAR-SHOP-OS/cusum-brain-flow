import { useState, useEffect, useCallback, useRef } from "react";
import { useTimeClock } from "@/hooks/useTimeClock";
import { useLeaveManagement } from "@/hooks/useLeaveManagement";
import { useFaceRecognition } from "@/hooks/useFaceRecognition";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, LogIn, LogOut, ArrowLeft, Timer, ScanFace, Maximize, Users, CalendarDays, Palmtree, DollarSign, Monitor, Factory, Trash2, Brain } from "lucide-react";
import { useProfiles } from "@/hooks/useProfiles";
import { ConfirmActionDialog } from "@/components/accounting/ConfirmActionDialog";
import { Link, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format, differenceInMinutes } from "date-fns";
import { toast } from "sonner";
import { FaceCamera } from "@/components/timeclock/FaceCamera";
import { FaceEnrollment } from "@/components/timeclock/FaceEnrollment";
import { FaceRecognitionResult } from "@/components/timeclock/FaceRecognitionResult";
import { FirstTimeRegistration } from "@/components/timeclock/FirstTimeRegistration";
import { MyLeaveTab } from "@/components/timeclock/MyLeaveTab";
import { TeamCalendarTab } from "@/components/timeclock/TeamCalendarTab";
import { PayrollSummaryTab } from "@/components/timeclock/PayrollSummaryTab";
import { FaceMemoryPanel } from "@/components/timeclock/FaceMemoryPanel";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TimeClock() {
  const { allEntries, activeEntry, loading, punching, clockIn, clockOut, adminClockOut, myProfile, profiles } = useTimeClock();
  const leave = useLeaveManagement();
  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const face = useFaceRecognition();
  const { deleteProfile } = useProfiles();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [clockOutTarget, setClockOutTarget] = useState<{ id: string; name: string } | null>(null);
  const [searchParams] = useSearchParams();

  const [faceMode, setFaceMode] = useState(false);
  const [kioskMode, setKioskMode] = useState(false);
  const [enrollmentCount, setEnrollmentCount] = useState(0);
  const [autoPunchCountdown, setAutoPunchCountdown] = useState(0);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);

  // Cache of profile IDs confirmed during this kiosk session
  const confirmedProfilesRef = useRef<Set<string>>(new Set());

  const now = new Date();

  // Fetch enrollment count
  const fetchEnrollmentCount = useCallback(async () => {
    if (!myProfile) return;
    const { count } = await supabase
      .from("face_enrollments")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", myProfile.id as any);
    setEnrollmentCount(count || 0);
  }, [myProfile]);

  useEffect(() => {
    fetchEnrollmentCount();
  }, [fetchEnrollmentCount]);

  // Auto-enter kiosk mode if ?kiosk=1
  useEffect(() => {
    if (searchParams.get("kiosk") === "1") {
      enterKioskMode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle face mode
  const handleFaceModeToggle = async (enabled: boolean) => {
    setFaceMode(enabled);
    if (enabled) {
      await face.startCamera();
    } else {
      face.stopCamera();
      face.reset();
    }
  };

  // Toggle kiosk mode
  const enterKioskMode = async () => {
    setKioskMode(true);
    setFaceMode(true);
    await face.startCamera();
    try {
      document.documentElement.requestFullscreen?.();
    } catch {}
    // User must tap "Scan Face" to start scanning
  };

  const exitKioskMode = () => {
    setKioskMode(false);
    face.stopCamera();
    face.reset();
    try {
      document.exitFullscreen?.();
    } catch {}
  };

  // Prevent double-scan
  const scanningRef = useRef(false);

  // Handle scan
  const handleScan = async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setShowRegistration(false);
    try {
      const result = await face.recognize();
      if (result && result.confidence >= 75) {
        const isKioskUser = user?.email?.toLowerCase() === "ai@rebar.shop";
        if (isKioskUser) {
          // ai@rebar.shop: immediate auto-punch, no confirmation needed
          setAutoPunchCountdown(1);
        } else if (confirmedProfilesRef.current.has(result.profile_id)) {
          setAutoPunchCountdown(1);
        } else if (result.confidence >= 85 && (result.enrollment_count ?? 0) >= 3) {
          setAutoPunchCountdown(1);
        } else if ((result.enrollment_count ?? 0) >= 3) {
          setAutoPunchCountdown(2);
        }
      }
    } finally {
      scanningRef.current = false;
    }
  };

  // Auto-punch countdown
  useEffect(() => {
    if (autoPunchCountdown <= 0 || face.state !== "matched" || !face.matchResult) return;
    const timer = setTimeout(() => {
      if (autoPunchCountdown === 1) {
        handleConfirmPunch(face.matchResult!.profile_id);
        setAutoPunchCountdown(0);
      } else {
        setAutoPunchCountdown((c) => c - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoPunchCountdown, face.state, face.matchResult]);

  // Confirm punch (manual or auto) — uses edge function for service-role access
  const handleConfirmPunch = async (profileId: string) => {
    const employeeName = face.matchResult?.name || "Employee";
    try {
      const { data, error } = await supabase.functions.invoke("kiosk-punch", {
        body: { profileId },
      });

      if (error) {
        console.error("[TimeClock] kiosk-punch error:", error);
        toast.error("Punch failed");
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        const action = data?.action;
        toast.success(`${employeeName} clocked ${action === "clock_out" ? "out" : "in"}!`);
      }
    } catch (err: any) {
      console.error("[TimeClock] kiosk-punch exception:", err);
      toast.error("Punch failed");
    }

    // Remember this person for the session so next scan skips confirmation
    confirmedProfilesRef.current.add(profileId);

    face.reset();
    setAutoPunchCountdown(0);

    // Kiosk resets — user must tap "Scan Face" for next person
  };

  // Build status map
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

  const activeProfiles = profiles.filter(
    (p) => !["General Labour", "Ryle Lachini", "Ai"].includes(p.full_name)
  );

  const officeProfiles = activeProfiles.filter(
    (p) => p.email?.toLowerCase().endsWith("@rebar.shop") && p.full_name !== "Kourosh Zand"
  );
  const shopProfiles = activeProfiles.filter(
    (p) => p.user_id && (!p.email?.toLowerCase().endsWith("@rebar.shop") || p.full_name === "Kourosh Zand")
  );

  // Shared team status card renderer
  const renderProfileCard = (profile: typeof profiles[0]) => {
    const status = statusMap.get(profile.id);
    const isClockedIn = status?.clocked_in ?? false;
    const clockInTime = status?.clock_in;
    const elapsed = isClockedIn && clockInTime ? differenceInMinutes(now, new Date(clockInTime)) : null;
    const profileEntries = allEntries.filter((e) => e.profile_id === profile.id);
    const totalMins = profileEntries.reduce((sum, e) => {
      const end = e.clock_out ? new Date(e.clock_out) : (isClockedIn ? now : new Date(e.clock_in));
      return sum + differenceInMinutes(end, new Date(e.clock_in));
    }, 0);

    return (
      <Card key={profile.id} className={cn("transition-colors", isClockedIn && "border-green-500/30 bg-green-500/5")}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="relative">
            <Avatar className="w-10 h-10">
              <AvatarImage src={profile.avatar_url || ""} />
              <AvatarFallback className="text-xs font-bold bg-muted text-foreground">{getInitials(profile.full_name)}</AvatarFallback>
            </Avatar>
            <div className={cn("absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card", isClockedIn ? "bg-green-500" : "bg-muted-foreground/40")} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{profile.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {isClockedIn
                ? `In since ${format(new Date(clockInTime!), "h:mm a")} · ${formatDuration(elapsed!)}${totalMins > elapsed! ? ` · Total: ${formatDuration(totalMins)}` : ""}`
                : totalMins > 0 ? `Worked ${formatDuration(totalMins)} today` : "Not clocked in"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className={cn("text-[10px] uppercase tracking-wider", isClockedIn && "bg-green-500/15 text-green-500")}>
              {isClockedIn ? "Active" : totalMins > 0 ? formatDuration(totalMins) : "Off"}
            </Badge>
            {isAdmin && isClockedIn && profile.id !== myProfile?.id && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setClockOutTarget({ id: profile.id, name: profile.full_name })}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Kiosk mode - full screen face scanning
  if (kioskMode) {
    const matchedIsClockedIn = face.matchResult
      ? !!allEntries.find((e) => e.profile_id === face.matchResult!.profile_id && !e.clock_out)
      : false;

    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6">
        <canvas ref={face.canvasRef} className="hidden" />
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {["radin@rebar.shop", "sattar@rebar.shop", "neel@rebar.shop"].includes(user?.email?.toLowerCase() ?? "") && (
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={() => setShowMemoryPanel(true)}>
              <Brain className="w-4 h-4" /> Memory
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={exitKioskMode}>
            Exit Kiosk
          </Button>
        </div>
        {/* FaceMemoryPanel moved to shared scope below */}
        <div className="flex items-center gap-3 mb-6">
          <ScanFace className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-black italic tracking-tight">FACE ID KIOSK</h1>
        </div>
        <div className="w-full max-w-lg">
          <FaceCamera videoRef={face.videoRef as any} isActive={!!face.cameraStream} scanning={face.state === "scanning"} stream={face.cameraStream} />
        </div>
        <div className="w-full max-w-lg mt-4">
          {face.state === "idle" && (
            <Button onClick={handleScan} size="lg" className="w-full text-lg font-bold gap-2">
              <ScanFace className="w-5 h-5" /> Scan Face
            </Button>
          )}
          {showRegistration ? (
            <FirstTimeRegistration
              captureFrame={face.captureFrame}
              onComplete={() => {
                setShowRegistration(false);
                face.reset();
              }}
              onCancel={() => { setShowRegistration(false); face.reset(); }}
            />
          ) : (face.state === "no_match" || face.state === "error" || face.state === "low_confidence") ? (
            <FirstTimeRegistration
              captureFrame={face.captureFrame}
              onComplete={() => {
                face.reset();
              }}
              onCancel={() => face.reset()}
            />
          ) : (
            <FaceRecognitionResult
              state={face.state}
              matchResult={face.matchResult}
              isClockedIn={matchedIsClockedIn}
              onConfirmPunch={handleConfirmPunch}
              onReject={() => { face.reset(); }}
              onNotMe={() => { setShowRegistration(true); }}
              autoPunchCountdown={autoPunchCountdown}
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-6">{format(now, "EEEE, MMMM d, yyyy · h:mm a")}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-2 text-center max-w-md leading-relaxed">
          Your photo and name are securely stored in this app's memory for clock-in and clock-out purposes.
          <br />
          عکس و نام شما در حافظه این برنامه برای ثبت ورود و خروج ذخیره می‌شود.
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="relative flex flex-col items-center min-h-screen bg-background overflow-hidden">
      <canvas ref={face.canvasRef} className="hidden" />
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-primary/8 blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full max-w-4xl px-6 pt-8 pb-4">
        <Link to="/shop-floor" className="inline-flex items-center gap-2 text-xs tracking-widest text-muted-foreground hover:text-foreground transition-colors uppercase mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Command Hub
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black italic text-foreground tracking-tight">TIME CLOCK</h1>
              <p className="text-xs tracking-widest text-muted-foreground uppercase">{format(now, "EEEE, MMMM d, yyyy")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <ScanFace className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Face ID</span>
              <Switch checked={faceMode} onCheckedChange={handleFaceModeToggle} />
            </div>
            <Button variant="outline" size="sm" className="gap-1" onClick={enterKioskMode}>
              <Maximize className="w-3.5 h-3.5" /> Kiosk
            </Button>
          </div>
        </div>
      </header>

      {/* Face Enrollment */}
      <div className="relative z-10 w-full max-w-4xl px-6 pt-4">
        <div className="flex items-center justify-between">
          <FaceEnrollment existingCount={enrollmentCount} onComplete={fetchEnrollmentCount} />
          <div className="flex items-center gap-2">
            {enrollmentCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {enrollmentCount} photo{enrollmentCount !== 1 ? "s" : ""} enrolled
              </Badge>
            )}
            {["radin@rebar.shop", "sattar@rebar.shop", "neel@rebar.shop"].includes(user?.email?.toLowerCase() ?? "") && (
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={() => setShowMemoryPanel(true)}>
                <Brain className="w-4 h-4" /> Memory
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Face Mode */}
      {faceMode ? (
        <div className="relative z-10 w-full max-w-4xl px-6 py-4 space-y-4">
          <FaceCamera videoRef={face.videoRef as any} isActive={!!face.cameraStream} scanning={face.state === "scanning"} stream={face.cameraStream} />
          {face.state === "idle" && (
            <Button onClick={handleScan} size="lg" className="w-full text-lg font-bold gap-2">
              <ScanFace className="w-5 h-5" /> Scan to Punch
            </Button>
          )}
          {face.state === "low_confidence" && (
            <FirstTimeRegistration
              captureFrame={face.captureFrame}
              onComplete={() => face.reset()}
              onCancel={() => face.reset()}
            />
          )}
          {(face.state !== "idle" && face.state !== "scanning" && face.state !== "low_confidence") && (
            <FaceRecognitionResult state={face.state} matchResult={face.matchResult} isClockedIn={!!activeEntry} onConfirmPunch={handleConfirmPunch} onReject={() => face.reset()} autoPunchCountdown={autoPunchCountdown} />
          )}
        </div>
      ) : (
        /* Manual Mode - My Clock Card */
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
                            {(() => {
                              const myTotalMins = entries.reduce((sum, e) => {
                                const end = e.clock_out ? new Date(e.clock_out) : now;
                                return sum + differenceInMinutes(end, new Date(e.clock_in));
                              }, 0);
                              const currentElapsed = differenceInMinutes(now, new Date(activeEntry.clock_in));
                              return myTotalMins > currentElapsed ? ` · Total: ${formatDuration(myTotalMins)}` : "";
                            })()}
                          </span>
                        </>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground">Not Clocked In</Badge>
                      )}
                    </div>
                  </div>
                </div>
                {activeEntry ? (
                  <Button size="lg" variant="destructive" className="gap-2 text-base font-bold px-8" onClick={clockOut} disabled={punching}>
                    <LogOut className="w-5 h-5" /> Clock Out
                  </Button>
                ) : (
                  <Button size="lg" className="gap-2 text-base font-bold px-8 bg-green-600 hover:bg-green-700 text-white" onClick={clockIn} disabled={punching}>
                    <LogIn className="w-5 h-5" /> Clock In
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabbed Content: Team Status / My Leave / Team Calendar */}
      <div className="relative z-10 w-full max-w-4xl px-6 py-4 flex-1">
        <Tabs defaultValue="team-status">
          <TabsList className="w-full">
            <TabsTrigger value="team-status" className="flex-1 gap-1.5">
              <Users className="w-3.5 h-3.5" /> Team Status Office
            </TabsTrigger>
            <TabsTrigger value="team-status-shop" className="flex-1 gap-1.5">
              <Factory className="w-3.5 h-3.5" /> Team Status Shop
            </TabsTrigger>
            <TabsTrigger value="my-leave" className="flex-1 gap-1.5">
              <Palmtree className="w-3.5 h-3.5" /> My Leave
            </TabsTrigger>
            <TabsTrigger value="team-calendar" className="flex-1 gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Team Calendar
            </TabsTrigger>
            <TabsTrigger value="payroll" className="flex-1 gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Payroll
            </TabsTrigger>
            <TabsTrigger value="kiosk-status" className="flex-1 gap-1.5 text-red-500 data-[state=active]:text-red-500">
              <Monitor className="w-3.5 h-3.5" /> Kiosk Status
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team-status">
            <ScrollArea className="h-[calc(100vh-480px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {loading ? (
                  <p className="text-muted-foreground text-sm col-span-2 text-center py-8">Loading...</p>
                ) : officeProfiles.length === 0 ? (
                  <p className="text-muted-foreground text-sm col-span-2 text-center py-8">No office team members</p>
                ) : (
                  officeProfiles.map(renderProfileCard)
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="team-status-shop">
            <ScrollArea className="h-[calc(100vh-480px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {loading ? (
                  <p className="text-muted-foreground text-sm col-span-2 text-center py-8">Loading...</p>
                ) : shopProfiles.length === 0 ? (
                  <p className="text-muted-foreground text-sm col-span-2 text-center py-8">No shop team members</p>
                ) : (
                  shopProfiles.map(renderProfileCard)
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="my-leave">
            <MyLeaveTab
              balance={leave.balance}
              requests={leave.myRequests}
              profiles={leave.profiles}
              onSubmit={leave.submitRequest}
              onCancel={leave.cancelRequest}
            />
          </TabsContent>

          <TabsContent value="team-calendar">
            <TeamCalendarTab
              requests={leave.allRequests}
              profiles={leave.profiles}
              onReview={leave.reviewRequest}
              currentProfileId={leave.myProfile?.id}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="payroll">
            <PayrollSummaryTab
              isAdmin={isAdmin}
              myProfile={myProfile as any}
              profiles={profiles as any}
            />
          </TabsContent>

          <TabsContent value="kiosk-status">
            <ScrollArea className="h-[calc(100vh-480px)]">
              <div className="space-y-4">
                {(() => {
                  const todayStart = new Date();
                  todayStart.setHours(0, 0, 0, 0);
                  const todayEntries = allEntries.filter((e: any) => new Date(e.clock_in) >= todayStart);
                  const kioskProfiles = activeProfiles;
                  const presentCount = kioskProfiles.filter(p => statusMap.get(p.id)?.clocked_in).length;

                  return (
                    <>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Monitor className="w-4 h-4" />
                        <span>{presentCount} people present</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {loading ? (
                          <p className="text-muted-foreground text-sm col-span-2 text-center py-8">Loading...</p>
                        ) : kioskProfiles.length === 0 ? (
                          <p className="text-muted-foreground text-sm col-span-2 text-center py-8">No team members found</p>
                        ) : (
                          kioskProfiles.map((profile) => {
                            const status = statusMap.get(profile.id);
                            const isClockedIn = status?.clocked_in ?? false;
                            const clockInTime = status?.clock_in;
                            const elapsed = isClockedIn && clockInTime ? differenceInMinutes(now, new Date(clockInTime)) : null;
                            const profileKioskEntries = todayEntries.filter((e) => e.profile_id === profile.id);
                            const totalMins = profileKioskEntries.reduce((sum, e) => {
                              const end = e.clock_out ? new Date(e.clock_out) : (isClockedIn ? now : new Date(e.clock_in));
                              return sum + differenceInMinutes(end, new Date(e.clock_in));
                            }, 0);

                            return (
                              <Card key={profile.id} className={cn("transition-colors", isClockedIn && "border-green-500/30 bg-green-500/5")}>
                                <CardContent className="p-4 flex items-center gap-3">
                                  <div className="relative">
                                    <Avatar className="w-10 h-10">
                                      <AvatarImage src={profile.avatar_url || ""} />
                                      <AvatarFallback className="text-xs font-bold bg-muted text-foreground">{getInitials(profile.full_name)}</AvatarFallback>
                                    </Avatar>
                                    <div className={cn("absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card", isClockedIn ? "bg-green-500" : "bg-muted-foreground/40")} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{profile.full_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {isClockedIn
                                        ? `In since ${format(new Date(clockInTime!), "h:mm a")} · ${formatDuration(elapsed!)}`
                                        : totalMins > 0 ? `Worked ${formatDuration(totalMins)} today` : "Not clocked in"}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="secondary" className={cn("text-[10px] uppercase tracking-wider", isClockedIn && "bg-green-500/15 text-green-500")}>
                                      {isClockedIn ? "Active" : totalMins > 0 ? formatDuration(totalMins) : "Off"}
                                    </Badge>
                                    {isAdmin && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => setDeleteTarget({ id: profile.id, name: profile.full_name })}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>

      <ConfirmActionDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Kiosk Profile"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This will remove their profile and all associated data.`}
        variant="destructive"
        confirmLabel="Yes, Delete"
        loading={deleteProfile.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteProfile.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          }
        }}
      />

      <ConfirmActionDialog
        open={!!clockOutTarget}
        onOpenChange={(open) => !open && setClockOutTarget(null)}
        title="Clock Out User"
        description={`Are you sure you want to clock out "${clockOutTarget?.name}"?`}
        variant="destructive"
        confirmLabel="Yes, Clock Out"
        loading={punching}
        onConfirm={async () => {
          if (clockOutTarget) {
            await adminClockOut(clockOutTarget.id);
            setClockOutTarget(null);
          }
        }}
      />
      {["radin@rebar.shop", "sattar@rebar.shop", "neel@rebar.shop"].includes(user?.email?.toLowerCase() ?? "") && (
        <FaceMemoryPanel open={showMemoryPanel} onOpenChange={setShowMemoryPanel} />
      )}
    </>
  );
}
