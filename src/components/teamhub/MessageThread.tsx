import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Globe, Hash } from "lucide-react";
import { format } from "date-fns";
import type { TeamMessage } from "@/hooks/useTeamChat";
import type { Profile } from "@/hooks/useProfiles";
import { cn } from "@/lib/utils";

const LANG_LABELS: Record<string, string> = {
  en: "English",
  fa: "فارسی",
  es: "Español",
  fr: "Français",
  ar: "العربية",
  hi: "हिन्दी",
  zh: "中文",
  de: "Deutsch",
  pt: "Português",
  ru: "Русский",
  ko: "한국어",
  ja: "日本語",
  tr: "Türkçe",
  ur: "اردو",
};

interface MessageThreadProps {
  channelName: string;
  messages: TeamMessage[];
  myProfile: Profile | null;
  myLang: string;
  isLoading: boolean;
  isSending: boolean;
  onSend: (text: string) => void;
}

export function MessageThread({
  channelName,
  messages,
  myProfile,
  myLang,
  isLoading,
  isSending,
  onSend,
}: MessageThreadProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
  };

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const getDisplayText = (msg: TeamMessage) => {
    // If it's my message, show original
    if (msg.sender_profile_id === myProfile?.id) return msg.original_text;
    // If translation exists for my language, show it
    if (msg.translations[myLang]) return msg.translations[myLang];
    // Fallback to original
    return msg.original_text;
  };

  const isRtl = (lang: string) => ["fa", "ar", "ur"].includes(lang);

  return (
    <div className="flex flex-col h-full">
      {/* Channel header */}
      <div className="border-b border-border px-4 py-3 flex items-center gap-2 bg-card/50">
        <Hash className="w-5 h-5 text-primary" />
        <h2 className="font-bold text-foreground">{channelName}</h2>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_profile_id === myProfile?.id;
              const displayText = getDisplayText(msg);
              const showTranslated = !isMine && msg.translations[myLang] && msg.original_language !== myLang;
              const displayLang = isMine ? msg.original_language : (msg.translations[myLang] ? myLang : msg.original_language);

              return (
                <div key={msg.id} className="flex gap-3">
                  <Avatar className="w-8 h-8 shrink-0 mt-1">
                    <AvatarImage src={msg.sender?.avatar_url || ""} />
                    <AvatarFallback className="bg-muted text-foreground text-xs font-bold">
                      {getInitials(msg.sender?.full_name || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {msg.sender?.full_name || "Unknown"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                      {showTranslated && (
                        <Badge variant="outline" className="text-[9px] gap-1 px-1.5 py-0">
                          <Globe className="w-2.5 h-2.5" />
                          {LANG_LABELS[msg.original_language] || msg.original_language} → {LANG_LABELS[myLang] || myLang}
                        </Badge>
                      )}
                    </div>
                    <p
                      className={cn(
                        "text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap",
                        isRtl(displayLang) && "text-right"
                      )}
                      dir={isRtl(displayLang) ? "rtl" : "ltr"}
                    >
                      {displayText}
                    </p>
                    {showTranslated && (
                      <p
                        className="text-[11px] text-muted-foreground mt-1 italic whitespace-pre-wrap"
                        dir={isRtl(msg.original_language) ? "rtl" : "ltr"}
                      >
                        {msg.original_text}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-3 bg-card/50">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Message #${channelName}...`}
              className="min-h-[44px] max-h-32 resize-none pr-12"
              rows={1}
              dir={isRtl(myLang) ? "rtl" : "ltr"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <Badge
              variant="outline"
              className="absolute right-2 bottom-2 text-[9px] px-1.5 py-0 pointer-events-none"
            >
              {LANG_LABELS[myLang] || myLang}
            </Badge>
          </div>
          <Button
            size="icon"
            className="shrink-0 h-11 w-11"
            onClick={handleSubmit}
            disabled={!input.trim() || isSending}
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
