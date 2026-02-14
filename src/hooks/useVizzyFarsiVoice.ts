import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-chat`;

interface FarsiVoiceOptions {
  onTranscript?: (role: "user" | "agent", text: string) => void;
  onStatusChange?: (status: "disconnected" | "connected" | "error") => void;
  onSpeakingChange?: (speaking: boolean) => void;
}

/**
 * Custom Farsi voice pipeline using:
 * - Browser SpeechRecognition (fa-IR) for STT
 * - admin-chat edge function (Gemini) for brain
 * - Browser SpeechSynthesis (fa-IR) for TTS
 */
export function useVizzyFarsiVoice(options: FarsiVoiceOptions = {}) {
  const [status, setStatus] = useState<"disconnected" | "connected" | "error">("disconnected");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [interimText, setInterimText] = useState("");

  const recognitionRef = useRef<any>(null);
  const messagesRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const processingRef = useRef(false);
  const contextSentRef = useRef(false);
  const contextRef = useRef<string>("");

  // Check browser support
  const isSupported = typeof window !== "undefined" && 
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) &&
    "speechSynthesis" in window;

  // Find best Farsi voice
  const getFarsiVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    // Prefer Google Farsi voice
    const googleFa = voices.find(v => v.lang.startsWith("fa") && v.name.toLowerCase().includes("google"));
    if (googleFa) return googleFa;
    // Any Farsi voice
    const anyFa = voices.find(v => v.lang.startsWith("fa"));
    if (anyFa) return anyFa;
    // Persian variant
    const persian = voices.find(v => v.lang.includes("fa-IR") || v.lang.includes("fa_IR"));
    return persian || null;
  }, []);

  // Speak text using browser TTS
  const speak = useCallback((text: string) => {
    if (!text.trim()) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fa-IR";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const farsiVoice = getFarsiVoice();
    if (farsiVoice) {
      utterance.voice = farsiVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      options.onSpeakingChange?.(true);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      options.onSpeakingChange?.(false);
      synthRef.current = null;
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      options.onSpeakingChange?.(false);
      synthRef.current = null;
    };

    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [getFarsiVoice, options]);

  // Send message to admin-chat and get response
  const sendToGemini = useCallback(async (userText: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    messagesRef.current.push({ role: "user", content: userText });
    options.onTranscript?.("user", userText);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        options.onTranscript?.("agent", "⚠️ لطفاً وارد شوید.");
        processingRef.current = false;
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: messagesRef.current,
          currentPage: "/vizzy",
        }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        options.onTranscript?.("agent", "⚠️ خطا در اتصال.");
        processingRef.current = false;
        return;
      }

      // Stream response
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullResponse = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) fullResponse += content;
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) fullResponse += content;
          } catch { /* ignore */ }
        }
      }

      if (!fullResponse) fullResponse = "پاسخی دریافت نشد.";

      // Store in history
      messagesRef.current.push({ role: "assistant", content: fullResponse });
      
      // Emit transcript
      options.onTranscript?.("agent", fullResponse);

      // Strip markdown for speech (remove **, #, etc.)
      const cleanText = fullResponse
        .replace(/[#*_`>\-]/g, "")
        .replace(/\n+/g, ". ")
        .trim();

      // Speak the response
      speak(cleanText);
    } catch (e: any) {
      if (e.name !== "AbortError") {
        options.onTranscript?.("agent", `⚠️ خطا: ${e.message}`);
      }
    } finally {
      processingRef.current = false;
      abortRef.current = null;
    }
  }, [options, speak]);

  // Start the voice session
  const startSession = useCallback(async () => {
    if (!isSupported) {
      setStatus("error");
      return false;
    }

    try {
      // Request mic permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Ensure voices are loaded
      if (window.speechSynthesis.getVoices().length === 0) {
        await new Promise<void>((resolve) => {
          window.speechSynthesis.onvoiceschanged = () => resolve();
          setTimeout(resolve, 2000); // fallback timeout
        });
      }

      // Initialize SpeechRecognition
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "fa-IR";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        setInterimText(interim);

        if (final.trim()) {
          setInterimText("");
          // Interrupt TTS if agent is speaking
          if (synthRef.current) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
          }
          sendToGemini(final.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setStatus("error");
        }
        // For "no-speech" errors, just continue listening
      };

      recognition.onend = () => {
        // Auto-restart if still connected
        if (status === "connected" && recognitionRef.current) {
          try { recognitionRef.current.start(); } catch {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      
      setStatus("connected");
      options.onStatusChange?.("connected");
      
      return true;
    } catch (err) {
      console.error("Failed to start Farsi voice:", err);
      setStatus("error");
      options.onStatusChange?.("error");
      return false;
    }
  }, [isSupported, sendToGemini, options, status]);

  // End session
  const endSession = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // prevent auto-restart
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    window.speechSynthesis.cancel();
    abortRef.current?.abort();
    setStatus("disconnected");
    setIsSpeaking(false);
    setInterimText("");
    options.onStatusChange?.("disconnected");
  }, [options]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      // SpeechRecognition doesn't have a mute — we stop/start it
      if (recognitionRef.current) {
        if (next) {
          try { recognitionRef.current.stop(); } catch {}
        } else {
          try { recognitionRef.current.start(); } catch {}
        }
      }
      return next;
    });
  }, []);

  // Send contextual update (prime the conversation history)
  const sendContextualUpdate = useCallback((context: string) => {
    contextRef.current = context;
    if (!contextSentRef.current) {
      // Add as system-like message in history
      messagesRef.current.unshift({ role: "user", content: `[CONTEXT] ${context}` });
      contextSentRef.current = true;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.stop(); } catch {}
      }
      window.speechSynthesis.cancel();
      abortRef.current?.abort();
    };
  }, []);

  return {
    status,
    isSpeaking,
    isMuted,
    isSupported,
    interimText,
    startSession,
    endSession,
    toggleMute,
    sendContextualUpdate,
  };
}
