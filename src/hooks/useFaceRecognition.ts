import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type RecognitionState = "idle" | "scanning" | "matched" | "low_confidence" | "no_match" | "error";

interface MatchResult {
  profile_id: string;
  name: string;
  confidence: number;
  reason: string;
  avatar_url: string | null;
  enrollment_count: number;
}

export function useFaceRecognition() {
  const [state, setState] = useState<RecognitionState>("idle");
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      return true;
    } catch (err) {
      console.error("Camera access denied:", err);
      toast.error("Camera access denied. Please allow camera permissions.");
      return false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, 640, 480);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    return dataUrl.split(",")[1];
  }, []);

  const recognize = useCallback(async () => {
    const base64 = captureFrame();
    if (!base64) {
      toast.error("Failed to capture frame");
      return null;
    }

    setState("scanning");
    setMatchResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("face-recognize", {
        body: { capturedImageBase64: base64 },
      });

      if (error) {
        console.error("Recognition error:", error);
        setState("error");
        const msg = typeof error === "object" && error?.message ? error.message : "Recognition failed";
        toast.error(msg);
        return null;
      }

      if (data.error) {
        setState("error");
        toast.error(data.error);
        return null;
      }

      if (data.matched && data.confidence >= 75) {
        const result: MatchResult = {
          profile_id: data.profile_id,
          name: data.name,
          confidence: data.confidence,
          reason: data.reason,
          avatar_url: data.avatar_url,
          enrollment_count: data.enrollment_count || 0,
        };
        setMatchResult(result);
        setState("matched");
        return result;
      } else if (data.matched && data.confidence >= 50) {
        const result: MatchResult = {
          profile_id: data.profile_id,
          name: data.name,
          confidence: data.confidence,
          reason: data.reason,
          avatar_url: data.avatar_url,
          enrollment_count: data.enrollment_count || 0,
        };
        setMatchResult(result);
        setState("low_confidence");
        return result;
      } else {
        setState("no_match");
        setMatchResult(null);
        return null;
      }
    } catch (err: any) {
      console.error("Recognition error:", err);
      setState("error");
      toast.error(err?.message || "Recognition failed");
      return null;
    }
  }, [captureFrame]);

  const reset = useCallback(() => {
    setState("idle");
    setMatchResult(null);
  }, []);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

  return {
    state,
    matchResult,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
    recognize,
    reset,
    cameraStream,
    captureFrame,
  };
}
