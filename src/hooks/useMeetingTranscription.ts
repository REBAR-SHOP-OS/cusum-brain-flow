import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TranscriptEntry {
  id: string;
  meeting_id: string;
  speaker_name: string;
  speaker_profile_id: string | null;
  text: string;
  timestamp_ms: number;
  is_final: boolean;
  language: string;
  created_at: string;
}

interface UseMeetingTranscriptionReturn {
  isTranscribing: boolean;
  entries: TranscriptEntry[];
  interimText: string;
  startTranscription: () => void;
  stopTranscription: () => void;
  isSupported: boolean;
}

export function useMeetingTranscription(
  meetingId: string | null,
  speakerName: string,
  speakerProfileId: string | null,
  meetingStartedAt: string | null
): UseMeetingTranscriptionReturn {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);
  const meetingStartRef = useRef<number>(0);

  const SpeechRecognitionAPI =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognitionAPI;

  // Subscribe to realtime transcript entries for this meeting
  useEffect(() => {
    if (!meetingId) return;

    // Fetch existing entries
    const fetchEntries = async () => {
      const { data } = await (supabase as any)
        .from("meeting_transcript_entries")
        .select("*")
        .eq("meeting_id", meetingId)
        .eq("is_final", true)
        .order("timestamp_ms", { ascending: true });
      if (data) setEntries(data);
    };
    fetchEntries();

    // Realtime subscription
    const channel = supabase
      .channel(`transcript-${meetingId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "meeting_transcript_entries",
        filter: `meeting_id=eq.${meetingId}`,
      }, (payload: any) => {
        const entry = payload.new as TranscriptEntry;
        if (entry.is_final) {
          setEntries((prev) => {
            if (prev.some((e) => e.id === entry.id)) return prev;
            return [...prev, entry];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId]);

  const startTranscription = useCallback(() => {
    if (!SpeechRecognitionAPI || !meetingId || isTranscribing) return;

    meetingStartRef.current = meetingStartedAt
      ? new Date(meetingStartedAt).getTime()
      : Date.now();

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    // lang not set — browser auto-detects spoken language

    recognition.onstart = () => setIsTranscribing(true);

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (!text) continue;
          const timestampMs = Date.now() - meetingStartRef.current;

          // Insert into DB (fire and forget)
          (supabase as any)
            .from("meeting_transcript_entries")
            .insert({
              meeting_id: meetingId,
              speaker_name: speakerName,
              speaker_profile_id: speakerProfileId,
              text,
              timestamp_ms: timestampMs,
              is_final: true,
              language: "en",
            })
            .then(({ error }: any) => {
              if (error) console.error("Failed to insert transcript:", error);
            });

          setInterimText("");
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Transcription error:", event.error);
      if (event.error === "not-allowed") {
        setIsTranscribing(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still active
      if (recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          setIsTranscribing(false);
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [SpeechRecognitionAPI, meetingId, isTranscribing, speakerName, speakerProfileId, meetingStartedAt]);

  const stopTranscription = useCallback(() => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      ref.stop();
      setIsTranscribing(false);
      setInterimText("");
    }
  }, []);

  return {
    isTranscribing,
    entries,
    interimText,
    startTranscription,
    stopTranscription,
    isSupported,
  };
}
