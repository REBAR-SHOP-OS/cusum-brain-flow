import { useState, useRef, useCallback } from "react";

interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

interface UseSpeechRecognitionOptions {
  onError?: (error: string) => void;
  onSilenceEnd?: () => void;
  silenceTimeout?: number; // ms after last final result before firing onSilenceEnd (default 1500)
  lang?: string; // BCP-47 language tag, e.g. "fa-IR", "en-US"
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
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const SpeechRecognitionAPI =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognitionAPI;

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI || isListening) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = optionsRef.current?.lang ?? "fa-IR";

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      let interim = "";
      let hadFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          hadFinal = true;
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
      if (interim) {
        setInterimText(interim);
        // User is still speaking — clear any pending silence timer
        clearSilenceTimer();
      }
      if (hadFinal) {
        // Start silence detection timer after a final result
        clearSilenceTimer();
        const timeout = optionsRef.current?.silenceTimeout ?? 1500;
        silenceTimerRef.current = setTimeout(() => {
          optionsRef.current?.onSilenceEnd?.();
        }, timeout);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setIsListening(false);
        optionsRef.current?.onError?.("Microphone access denied. Please allow microphone permissions.");
      } else if (event.error === "no-speech") {
        optionsRef.current?.onError?.("No speech detected. Please try again.");
      } else if (event.error === "aborted") {
        // Expected when recognition is stopped programmatically -- ignore
        return;
      } else if (event.error === "network") {
        optionsRef.current?.onError?.("Network error during speech recognition.");
      } else {
        optionsRef.current?.onError?.(`Speech recognition error: ${event.error}`);
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
  }, [SpeechRecognitionAPI, isListening, clearSilenceTimer]);

  const stop = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      ref.stop();
      setIsListening(false);
      setInterimText("");
    }
  }, [clearSilenceTimer]);

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
