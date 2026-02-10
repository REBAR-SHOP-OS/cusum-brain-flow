import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseMeetingRecorderReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  duration: number;
}

export function useMeetingRecorder(meetingId: string | null): UseMeetingRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    if (!meetingId || isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(1000); // Collect data every second
      recorderRef.current = recorder;
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  }, [meetingId, isRecording]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recorderRef.current || !meetingId) return null;

    return new Promise((resolve) => {
      const recorder = recorderRef.current!;

      recorder.onstop = async () => {
        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Stop all tracks
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];

        if (blob.size === 0) {
          setIsRecording(false);
          resolve(null);
          return;
        }

        // Upload to storage
        const path = `${meetingId}/audio.webm`;
        const { error } = await supabase.storage
          .from("meeting-recordings")
          .upload(path, blob, { upsert: true, contentType: "audio/webm" });

        if (error) {
          console.error("Failed to upload recording:", error);
          setIsRecording(false);
          resolve(null);
          return;
        }

        // Update meeting record with the recording path
        await (supabase as any)
          .from("team_meetings")
          .update({ recording_url: path })
          .eq("id", meetingId);

        setIsRecording(false);
        resolve(path);
      };

      recorder.stop();
    });
  }, [meetingId]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    duration,
  };
}
