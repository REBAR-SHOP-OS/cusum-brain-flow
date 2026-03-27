import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfiles } from "@/hooks/useProfiles";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2, ImageOff, Brain, UserPlus, Camera, Check, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PHOTO_LABELS = ["Front", "Slight Left", "Slight Right"] as const;

interface Enrollment {
  id: string;
  profile_id: string;
  photo_url: string;
  is_active: boolean;
  created_at: string;
}

interface ProfileGroup {
  profile_id: string;
  full_name: string;
  avatar_url: string | null;
  enrollments: Enrollment[];
  signedUrls: Map<string, string>;
}

interface FaceMemoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FaceMemoryPanel({ open, onOpenChange }: FaceMemoryPanelProps) {
  const [groups, setGroups] = useState<ProfileGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // Manual enrollment state
  const [adding, setAdding] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [captureStep, setCaptureStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { profiles, createProfile } = useProfiles();
  const [newPersonName, setNewPersonName] = useState("");
  const [creatingNewPerson, setCreatingNewPerson] = useState(false);

  const videoCallbackRef = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    if (video && streamRef.current) {
      video.srcObject = streamRef.current;
      video.play().catch(() => {});
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch {
      toast.error("Camera access denied");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 640, 480);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setPhotos((prev) => [...prev, dataUrl]);
    setCaptureStep((prev) => prev + 1);
    if (captureStep >= 2) stopCamera();
  }, [captureStep, stopCamera]);

  const resetAddForm = useCallback(() => {
    setAdding(false);
    setSelectedProfileId("");
    setCaptureStep(0);
    setPhotos([]);
    setNewPersonName("");
    setCreatingNewPerson(false);
    stopCamera();
  }, [stopCamera]);

  const uploadManualEnrollment = async () => {
    if (!selectedProfileId || photos.length < 3) return;
    setUploading(true);
    try {
      // Find profile to get user_id for storage path
      const profile = profiles.find((p) => p.id === selectedProfileId);
      const storagePrefix = profile?.user_id || selectedProfileId;

      for (let i = 0; i < photos.length; i++) {
        const base64 = photos[i].split(",")[1];
        const byteArray = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const filePath = `${storagePrefix}/photo-${Date.now()}-${i}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from("face-enrollments")
          .upload(filePath, byteArray, { contentType: "image/jpeg" });
        if (uploadErr) throw uploadErr;

        const { error: insertErr } = await supabase
          .from("face_enrollments")
          .insert({ profile_id: selectedProfileId, photo_url: filePath } as any);
        if (insertErr) throw insertErr;
      }

      toast.success(`Face enrolled for ${profile?.full_name || "user"}!`);
      resetAddForm();
      fetchData();
    } catch (err) {
      console.error("Manual enrollment error:", err);
      toast.error("Failed to enroll. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const fetchData = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const { data: enrollments, error: eErr } = await supabase
        .from("face_enrollments")
        .select("id, profile_id, photo_url, is_active, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (eErr) {
        console.error("Failed to fetch enrollments:", eErr);
        setLoading(false);
        return;
      }

      const profileIds = [...new Set((enrollments || []).map((e: any) => e.profile_id))];
      if (profileIds.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", profileIds);

      const profileMap = new Map<string, { full_name: string; avatar_url: string | null }>();
      (profilesData || []).forEach((p: any) => profileMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url }));

      const groupMap = new Map<string, Enrollment[]>();
      (enrollments || []).forEach((e: any) => {
        const list = groupMap.get(e.profile_id) || [];
        list.push(e);
        groupMap.set(e.profile_id, list);
      });

      const result: ProfileGroup[] = [];
      for (const [profileId, items] of groupMap.entries()) {
        const profile = profileMap.get(profileId);
        const limited = items.slice(0, 3);
        const signedUrls = new Map<string, string>();

        for (const item of limited) {
          const storagePath = item.photo_url.replace(/^.*face-enrollments\//, "");
          const { data } = await supabase.storage
            .from("face-enrollments")
            .createSignedUrl(storagePath, 600);
          if (data?.signedUrl) {
            signedUrls.set(item.id, data.signedUrl);
          }
        }

        result.push({
          profile_id: profileId,
          full_name: profile?.full_name || "Unknown",
          avatar_url: profile?.avatar_url || null,
          enrollments: items,
          signedUrls,
        });
      }

      result.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setGroups(result);
    } catch (err) {
      console.error("FaceMemoryPanel fetch error:", err);
    }
    setLoading(false);
  }, [open]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cleanup camera on unmount or close
  useEffect(() => {
    if (!open) resetAddForm();
  }, [open, resetAddForm]);

  const handleDeleteAll = async (profileId: string, name: string) => {
    const { error } = await supabase
      .from("face_enrollments")
      .update({ is_active: false } as any)
      .eq("profile_id", profileId)
      .eq("is_active", true);

    if (error) {
      toast.error(`Failed to clear enrollments for ${name}`);
    } else {
      toast.success(`Cleared all face data for ${name}`);
      fetchData();
    }
  };

  const handleDeleteSingle = async (enrollmentId: string) => {
    const { error } = await supabase
      .from("face_enrollments")
      .update({ is_active: false } as any)
      .eq("id", enrollmentId);
    if (error) toast.error("Failed to delete photo");
    else { toast.success("Photo removed"); fetchData(); }
  };

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  // Profiles not yet enrolled
  const enrolledProfileIds = new Set(groups.map((g) => g.profile_id));
  const availableProfiles = profiles.filter((p) => p.is_active && !enrolledProfileIds.has(p.id));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-lg font-black italic tracking-tight">
            <Brain className="w-5 h-5 text-primary" />
            FACE MEMORY
          </SheetTitle>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {groups.length} people enrolled · {groups.reduce((s, g) => s + g.enrollments.length, 0)} photos total
            </p>
            {!adding && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setAdding(true)}>
                <UserPlus className="w-3.5 h-3.5" /> Add Person
              </Button>
            )}
          </div>
        </SheetHeader>

        <canvas ref={canvasRef} className="hidden" />

        <ScrollArea className="h-[calc(100vh-120px)]">
          {/* Manual enrollment form */}
          {adding && (
            <div className="p-4 border-b border-border bg-muted/30 space-y-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetAddForm}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <p className="font-semibold text-sm">Enroll New Person</p>
              </div>

              {/* Step 1: Select profile */}
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a person..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                  {/* Also allow re-enrolling existing people */}
                  {profiles.filter((p) => p.is_active && enrolledProfileIds.has(p.id)).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name} (re-enroll)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedProfileId && captureStep < 3 && (
                <>
                  <div className="flex gap-2 justify-center">
                    {PHOTO_LABELS.map((label, i) => (
                      <Badge
                        key={label}
                        variant={i < captureStep ? "default" : i === captureStep ? "secondary" : "outline"}
                        className={cn(
                          "gap-1 text-[10px]",
                          i < captureStep && "bg-green-500/15 text-green-500 border-green-500/30"
                        )}
                      >
                        {i < captureStep ? <Check className="w-3 h-3" /> : null}
                        {label}
                      </Badge>
                    ))}
                  </div>

                  <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                    {cameraActive ? (
                      <video ref={videoCallbackRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Camera className="w-10 h-10 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-36 h-36 rounded-full border-4 border-dashed border-white/40" />
                    </div>
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    Position face {PHOTO_LABELS[captureStep].toLowerCase()} and capture
                  </p>

                  {!cameraActive ? (
                    <Button onClick={startCamera} className="w-full gap-2" size="sm">
                      <Camera className="w-4 h-4" /> Start Camera
                    </Button>
                  ) : (
                    <Button onClick={capturePhoto} className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white" size="sm">
                      <Camera className="w-4 h-4" /> Capture {PHOTO_LABELS[captureStep]}
                    </Button>
                  )}
                </>
              )}

              {selectedProfileId && captureStep >= 3 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((src, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden aspect-square">
                        <img src={src} alt={PHOTO_LABELS[i]} className="w-full h-full object-cover" />
                        <Badge className="absolute bottom-1 left-1 text-[8px] bg-green-500/80">
                          {PHOTO_LABELS[i]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => { setCaptureStep(0); setPhotos([]); }} disabled={uploading}>
                      <X className="w-3.5 h-3.5" /> Retake
                    </Button>
                    <Button size="sm" className="flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={uploadManualEnrollment} disabled={uploading}>
                      <Check className="w-3.5 h-3.5" /> {uploading ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Enrolled list */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 && !adding ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Brain className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">No faces enrolled yet</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {groups.map((group) => (
                <div key={group.profile_id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={group.avatar_url || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {getInitials(group.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{group.full_name}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {group.enrollments.length} photo{group.enrollments.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteAll(group.profile_id, group.full_name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {group.enrollments.slice(0, 5).map((enrollment) => {
                      const url = group.signedUrls.get(enrollment.id);
                      return (
                        <div
                          key={enrollment.id}
                          className={cn(
                            "relative group w-16 h-16 rounded-lg border border-border overflow-hidden flex-shrink-0 bg-muted/30",
                            "flex items-center justify-center"
                          )}
                        >
                          {url ? (
                            <img src={url} alt={group.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageOff className="w-4 h-4 text-muted-foreground" />
                          )}
                          <button
                            onClick={() => handleDeleteSingle(enrollment.id)}
                            className="absolute top-0 right-0 w-5 h-5 bg-destructive text-destructive-foreground rounded-bl-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
