import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { NilaMessage } from "@/hooks/useNilaVoiceAssistant";
import { getNilaT } from "@/lib/nilaI18n";
import { cn } from "@/lib/utils";
import { detectRtl } from "@/utils/textDirection";

interface Props {
  messages: NilaMessage[];
}

export function NilaChatMessages({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const t = getNilaT();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-gray-500 text-sm">{t.noMessages}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 nila-scrollbar">
      {messages.map((msg) => {
        const isRtl = detectRtl(msg.content);
        const isUser = msg.role === "user";
        const isSystem = msg.role === "system";
        const isAssistant = msg.role === "assistant";

        return (
          <div
            key={msg.id}
            className={cn(
              "max-w-[85%] px-3 py-2 rounded-2xl text-sm animate-[nila-fade-up_0.3s_ease-out]",
              isUser && "ml-auto bg-white/10 text-white",
              isAssistant && "mr-auto nila-glass-strong text-white",
              isSystem && "mx-auto nila-glass text-purple-300 text-center text-xs"
            )}
            dir={isRtl ? "rtl" : "ltr"}
          >
            {isAssistant ? (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              msg.content
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
