import { useState, useCallback } from "react";
import { Send } from "lucide-react";
import { getNilaT } from "@/lib/nilaI18n";

interface Props {
  interimText: string;
  onSend: (text: string) => void;
}

export function NilaTextInput({ interimText, onSend }: Props) {
  const [input, setInput] = useState("");
  const t = getNilaT();

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
  }, [input, onSend]);

  return (
    <div className="w-full px-4 pb-4">
      <div className="flex items-center gap-2 nila-glass rounded-2xl px-4 py-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={interimText || t.placeholder}
          className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-gray-500"
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className="p-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white disabled:opacity-30 transition-opacity"
          aria-label={t.send}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
