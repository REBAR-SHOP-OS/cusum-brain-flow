import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfiles } from "@/hooks/useProfiles";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, Check, X, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PHOTO_LABELS = ["Front", "Slight Left", "Slight Right"] as const;

interface FaceEnrollmentProps {
  existingCount: number;
  onComplete: () => void;
}

export function FaceEnrollment({ existingCount, onComplete }: FaceEnrollmentProps) {
  const { user } = useAuth();
  const { profiles } = useProfiles();
  const myProfile = profiles.find((p) => p.user_id === user?.id);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    setStep((prev) => prev + 1);

    if (step >= 2) {
      stopCamera();
    }
  }, [step, stopCamera]);

  const uploadPhotos = async () => {
    if (!myProfile || !user || photos.length < 3) return;
    setUploading(true);

    try {
      for (let i = 0; i < photos.length; i++) {
        const base64 = photos[i].split(",")[1];
        const byteArray = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const filePath = `${user.id}/photo-${Date.now()}-${i}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from("face-enrollments")
          .upload(filePath, byteArray, { contentType: "image/jpeg" });

        if (uploadErr) throw uploadErr;

        const { error: insertErr } = await supabase
          .from("face_enrollments")
          .insert({ profile_id: myProfile.id, photo_url: filePath } as any);

        if (insertErr) throw insertErr;
      }

      toast.success("Face ID enrolled successfully!");
      setOpen(false);
      resetState();
      onComplete();
    } catch (err) {
      console.error("Enrollment error:", err);
      toast.error("Failed to enroll. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const resetState = () => {
    setStep(0);
    setPhotos([]);
    stopCamera();
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetState();
  };

  const deleteEnrollment = async () => {
    if (!myProfile) return;
    try {
      const { error } = await supabase
        .from("face_enrollments")
        .delete()
        .eq("profile_id", myProfile.id as any);
      if (error) throw error;

      // Also remove storage files
      const { data: files } = await supabase.storage
        .from("face-enrollments")
        .list(user?.id || "");
      if (files) {
        const paths = files.map((f) => `${user?.id}/${f.name}`);
        if (paths.length > 0) {
          await supabase.storage.from("face-enrollments").remove(paths);
        }
      }

      toast.success("Face enrollment deleted");
      onComplete();
    } catch {
      toast.error("Failed to delete enrollment");
    }
  };

  return (
    <div className="flex items-center gap-2">
      {existingCount > 0 && (
        <Button variant="ghost" size="sm" onClick={deleteEnrollment} className="text-destructive gap-1">
          <Trash2 className="w-3.5 h-3.5" /> Remove Face ID
        </Button>
      )}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <UserPlus className="w-4 h-4" />
            {existingCount > 0 ? "Re-enroll Face ID" : "Enroll Face ID"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll Face ID</DialogTitle>
          </DialogHeader>
          <canvas ref={canvasRef} className="hidden" />

          {step < 3 ? (
            <div className="space-y-4">
              <div className="flex gap-2 justify-center">
                {PHOTO_LABELS.map((label, i) => (
                  <Badge
                    key={label}
                    variant={i < step ? "default" : i === step ? "secondary" : "outline"}
                    className={cn(
                      "gap-1",
                      i < step && "bg-green-500/15 text-green-500 border-green-500/30"
                    )}
                  >
                    {i < step ? <Check className="w-3 h-3" /> : null}
                    {label}
                  </Badge>
                ))}
              </div>

              <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                {cameraActive ? (
                  <video ref={videoCallbackRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Camera className="w-12 h-12 text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 rounded-full border-4 border-dashed border-white/40" />
                </div>
              </div>

              <p className="text-sm text-center text-muted-foreground">
                {step < 3
                  ? `Position your face ${PHOTO_LABELS[step].toLowerCase()} and capture`
                  : "All photos captured!"}
              </p>

              {!cameraActive ? (
                <Button onClick={startCamera} className="w-full gap-2">
                  <Camera className="w-4 h-4" /> Start Camera
                </Button>
              ) : (
                <Button onClick={capturePhoto} className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white">
                  <Camera className="w-4 h-4" /> Capture {PHOTO_LABELS[step]}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {photos.map((src, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden aspect-square">
                    <img src={src} alt={PHOTO_LABELS[i]} className="w-full h-full object-cover" />
                    <Badge className="absolute bottom-1 left-1 text-[9px] bg-green-500/80">
                      {PHOTO_LABELS[i]}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={resetState}
                  disabled={uploading}
                >
                  <X className="w-4 h-4" /> Retake
                </Button>
                <Button
                  className="flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={uploadPhotos}
                  disabled={uploading}
                >
                  <Check className="w-4 h-4" /> {uploading ? "Uploading..." : "Save Enrollment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
