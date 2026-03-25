import { useState, useRef, useCallback, useEffect } from "react";

export type NilaMode = "normal" | "silent" | "translate";
export type NilaStatus = "ready" | "listening" | "processing" | "speaking";

export interface NilaMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

// ElevenLabs voice mapping
export const NILA_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", label: "Sarah", gender: "female" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", label: "George", gender: "male" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", label: "Laura", gender: "female" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", label: "Charlie", gender: "male" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", label: "Matilda", gender: "female" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", label: "Liam", gender: "male" },
] as const;

const MODE_COMMANDS: Record<string, NilaMode> = {
  "1": "normal", "۱": "normal", "یک": "normal", "یه": "normal", "one": "normal",
  "2": "silent", "۲": "silent", "دو": "silent", "two": "silent",
  "3": "translate", "۳": "translate", "سه": "translate", "three": "translate",
};

function detectModeCommand(text: string): NilaMode | null {
  const trimmed = text.trim().toLowerCase();
  return MODE_COMMANDS[trimmed] ?? null;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?؟؛\n])\s*/).filter((s) => s.trim().length > 0);
}

export function useNilaVoiceAssistant() {
  const [mode, setMode] = useState<NilaMode>("normal");
  const [status, setStatus] = useState<NilaStatus>("ready");
  const [messages, setMessages] = useState<NilaMessage[]>([]);
  const [interimText, setInterimText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<string>(NILA_VOICES[0].id);
  const [isRecognizing, setIsRecognizing] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isRecognizingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const audioCache = useRef(new Map<string, HTMLAudioElement>());
  const ttsQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    isRecognizingRef.current = isRecognizing;
  }, [isRecognizing]);

  const addMessage = useCallback((role: NilaMessage["role"], content: string) => {
    const msg: NilaMessage = { id: crypto.randomUUID(), role, content, timestamp: Date.now() };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  // ---- TTS ----
  const playTts = useCallback(async (text: string): Promise<void> => {
    const cached = audioCache.current.get(text);
    if (cached) {
      cached.currentTime = 0;
      await cached.play();
      return;
    }
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text, voiceId: selectedVoice }),
      });
      if (!resp.ok) throw new Error("TTS failed");
      const blob = await resp.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      if (audioCache.current.size >= 20) {
        const firstKey = audioCache.current.keys().next().value;
        if (firstKey) audioCache.current.delete(firstKey);
      }
      audioCache.current.set(text, audio);
      await audio.play();
    } catch (err) {
      console.warn("[Nila TTS] fallback to browser speech", err);
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = /[\u0600-\u06FF]/.test(text) ? "fa-IR" : "en-US";
      speechSynthesis.speak(utter);
      await new Promise<void>((r) => { utter.onend = () => r(); utter.onerror = () => r(); });
    }
  }, [selectedVoice]);

  const processTtsQueue = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setStatus("speaking");
    while (ttsQueueRef.current.length > 0) {
      const sentence = ttsQueueRef.current.shift()!;
      const next = ttsQueueRef.current[0];
      if (next) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: next, voiceId: selectedVoice }),
        }).then(r => r.blob()).then(b => {
          const a = new Audio(URL.createObjectURL(b));
          audioCache.current.set(next, a);
        }).catch(() => {});
      }
      await playTts(sentence);
    }
    isPlayingRef.current = false;
    setStatus(isRecognizingRef.current ? "listening" : "ready");
  }, [playTts, selectedVoice]);

  // ---- AI Chat (streaming) ----
  const sendToAI = useCallback(async (userText: string) => {
    setStatus("processing");
    const chatMessages = messages.slice(-4).map((m) => ({ role: m.role, content: m.content }));
    chatMessages.push({ role: "user", content: userText });

    abortRef.current = new AbortController();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nila-chat`;

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: chatMessages, mode }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Chat failed (${resp.status})`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      const assistantId = crypto.randomUUID();

      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: Date.now() }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m))
              );
            }
          } catch {}
        }
      }

      // Queue TTS
      if (fullText.trim()) {
        const sentences = splitSentences(fullText);
        ttsQueueRef.current.push(...sentences);
        processTtsQueue();
      } else {
        setStatus(isRecognizingRef.current ? "listening" : "ready");
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("[Nila chat]", err);
        addMessage("system", `Error: ${err.message}`);
      }
      setStatus(isRecognizingRef.current ? "listening" : "ready");
    }
  }, [messages, mode, processTtsQueue, addMessage]);

  // ---- Process Input ----
  const processInput = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const modeCmd = detectModeCommand(trimmed);
    if (modeCmd) {
      setMode(modeCmd);
      const labels = { normal: "Normal", silent: "Silent", translate: "Translate" };
      addMessage("system", `Mode: ${labels[modeCmd]}`);
      return;
    }

    if (mode === "silent") return;

    addMessage("user", trimmed);
    sendToAI(trimmed);
  }, [mode, addMessage, sendToAI]);

  // ---- Speech Recognition ----
  const startRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addMessage("system", "Speech recognition not supported in this browser.");
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    // Don't set recognition.lang — let browser auto-detect the spoken language

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
      if (final) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          processInput(final);
          setInterimText("");
        }, 800);
      }
    };

    recognition.onerror = (e: any) => {
      console.warn("[Nila SR] error:", e.error);
      if (e.error === "not-allowed") {
        addMessage("system", "Microphone access denied.");
        setIsRecognizing(false);
        isRecognizingRef.current = false;
        setStatus("ready");
      }
    };

    recognition.onend = () => {
      // Use ref to avoid stale closure
      if (isRecognizingRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecognizing(true);
    isRecognizingRef.current = true;
    setStatus("listening");
  }, [processInput, addMessage]);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsRecognizing(false);
    isRecognizingRef.current = false;
    if (status === "listening") setStatus("ready");
    setInterimText("");
  }, [status]);

  const toggleRecognition = useCallback(() => {
    if (isRecognizing) {
      stopRecognition();
    } else {
      startRecognition();
    }
  }, [isRecognizing, startRecognition, stopRecognition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecognition();
      if (abortRef.current) abortRef.current.abort();
      speechSynthesis.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendText = useCallback((text: string) => {
    processInput(text);
  }, [processInput]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    mode, setMode,
    status,
    messages, addMessage, clearMessages,
    interimText,
    selectedVoice, setSelectedVoice,
    isRecognizing,
    toggleRecognition,
    sendText,
  };
}
