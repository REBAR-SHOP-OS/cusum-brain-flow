import { useState, useRef, useCallback } from "react";

interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

interface UseSpeechRecognitionOptions {
  onError?: (error: string) => void;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcripts: TranscriptEntry[];
  interimText: string;
  fullTranscript: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
  isSupported: boolean;
}

export function useSpeechRecognition(options?: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);
  const idCounter = useRef(0);

  const SpeechRecognitionAPI =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognitionAPI;

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI || isListening) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const entry: TranscriptEntry = {
            id: `t-${++idCounter.current}`,
            text: result[0].transcript.trim(),
            timestamp: new Date(),
            isFinal: true,
          };
          setTranscripts((prev) => [...prev, entry]);
          setInterimText("");
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setIsListening(false);
        options?.onError?.("Microphone access denied. Please allow microphone permissions.");
      } else if (event.error === "no-speech") {
        options?.onError?.("No speech detected. Please try again.");
      } else if (event.error === "network") {
        options?.onError?.("Network error during speech recognition.");
      } else {
        options?.onError?.(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [SpeechRecognitionAPI, isListening]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      ref.stop();
      setIsListening(false);
      setInterimText("");
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    setTranscripts([]);
    setInterimText("");
  }, [stop]);

  const fullTranscript = transcripts.map((t) => t.text).join(" ");

  return {
    isListening,
    transcripts,
    interimText,
    fullTranscript,
    start,
    stop,
    reset,
    isSupported,
  };
}
