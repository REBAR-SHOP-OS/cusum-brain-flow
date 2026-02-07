import { useState, useRef, useEffect, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Send,
  Loader2,
  Globe,
  Hash,
  Smile,
  Paperclip,
  AtSign,
  Bold,
  Italic,
  List,
  Code,
  Users,
  Pin,
  Search,
  MoreHorizontal,
  Languages,
  ChevronDown,
  MessageSquare,
  Video,
  Phone,
  MonitorUp,
} from "lucide-react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import type { TeamMessage } from "@/hooks/useTeamChat";
import type { Profile } from "@/hooks/useProfiles";
import type { TeamMeeting } from "@/hooks/useTeamMeetings";
import { cn } from "@/lib/utils";

const LANG_LABELS: Record<string, { name: string; flag: string }> = {
  en: { name: "English", flag: "🇬🇧" },
  fa: { name: "فارسی", flag: "🇮🇷" },
  ar: { name: "العربية", flag: "🇸🇦" },
  es: { name: "Español", flag: "🇪🇸" },
  fr: { name: "Français", flag: "🇫🇷" },
  hi: { name: "हिन्दी", flag: "🇮🇳" },
  zh: { name: "中文", flag: "🇨🇳" },
  de: { name: "Deutsch", flag: "🇩🇪" },
  tr: { name: "Türkçe", flag: "🇹🇷" },
  pt: { name: "Português", flag: "🇧🇷" },
  ru: { name: "Русский", flag: "🇷🇺" },
  ko: { name: "한국어", flag: "🇰🇷" },
  ja: { name: "日本語", flag: "🇯🇵" },
  ur: { name: "اردو", flag: "🇵🇰" },
};

function getLang(code: string) {
  return LANG_LABELS[code] || { name: code, flag: "🌐" };
}

interface MessageThreadProps {
  channelName: string;
  channelDescription: string | null;
  messages: TeamMessage[];
  profiles: Profile[];
  myProfile: Profile | null;
  myLang: string;
  isLoading: boolean;
  isSending: boolean;
  onSend: (text: string) => void;
  activeMeetings?: TeamMeeting[];
  onStartMeeting?: () => void;
  onJoinMeeting?: (meeting: TeamMeeting) => void;
}

const avatarColors = [
  "bg-violet-500", "bg-amber-500", "bg-pink-500", "bg-teal-500",
  "bg-blue-500", "bg-red-500", "bg-emerald-500", "bg-indigo-500",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function isRtl(lang: string) {
  return ["fa", "ar", "ur"].includes(lang);
}

function formatDateSeparator(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMMM d");
}

export function MessageThread({
  channelName,
  channelDescription,
  messages,
  profiles,
  myProfile,
  myLang,
  isLoading,
  isSending,
  onSend,
  activeMeetings = [],
  onStartMeeting,
  onJoinMeeting,
}: MessageThreadProps) {
  const [input, setInput] = useState("");
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    textareaRef.current?.focus();
  };

  const getDisplayText = (msg: TeamMessage) => {
    if (msg.sender_profile_id === myProfile?.id) return msg.original_text;
    if (showOriginal.has(msg.id)) return msg.original_text;
    if (msg.translations[myLang]) return msg.translations[myLang];
    return msg.original_text;
  };

  const toggleOriginal = (msgId: string) => {
    setShowOriginal((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  // Group messages with date separators
  const groupedMessages = useMemo(() => {
    const groups: { type: "date" | "message"; date?: Date; msg?: TeamMessage; isGrouped?: boolean }[] = [];
    let lastDate: Date | null = null;
    let lastSenderId: string | null = null;
    let lastTime: Date | null = null;

    for (const msg of messages) {
      const msgDate = new Date(msg.created_at);

      // Date separator
      if (!lastDate || !isSameDay(lastDate, msgDate)) {
        groups.push({ type: "date", date: msgDate });
        lastSenderId = null;
      }

      // Group consecutive messages from same sender within 5 minutes
      const isGrouped =
        lastSenderId === msg.sender_profile_id &&
        lastTime &&
        (msgDate.getTime() - lastTime.getTime()) < 5 * 60 * 1000;

      groups.push({ type: "message", msg, isGrouped: !!isGrouped });
      lastDate = msgDate;
      lastSenderId = msg.sender_profile_id;
      lastTime = msgDate;
    }
    return groups;
  }, [messages]);

  const memberCount = profiles.filter((p) => p.is_active).length;
  const myLangInfo = getLang(myLang);

  return (
    <div className="flex flex-col h-full">
      {/* Channel Header */}
      <div className="border-b border-border px-5 py-3 flex items-center justify-between bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Hash className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-sm">{channelName}</h2>
            {channelDescription && (
              <p className="text-[11px] text-muted-foreground">{channelDescription}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            {/* Meeting buttons */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:text-primary"
                  onClick={onStartMeeting}
                >
                  <Video className="w-4 h-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Start meeting</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Audio call</TooltipContent>
            </Tooltip>
            <div className="w-px h-4 bg-border mx-0.5" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Users className="w-4 h-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{memberCount} members</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Pin className="w-4 h-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pinned messages</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Search className="w-4 h-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Search in channel</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Active Meeting Banner */}
      {activeMeetings.length > 0 && (
        <div className="border-b border-border bg-primary/5 px-5 py-2">
          {activeMeetings.map((m) => (
            <div key={m.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-semibold text-foreground">{m.title}</span>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1">
                  {m.meeting_type === "video" && <Video className="w-2.5 h-2.5" />}
                  {m.meeting_type === "audio" && <Phone className="w-2.5 h-2.5" />}
                  {m.meeting_type === "screen_share" && <MonitorUp className="w-2.5 h-2.5" />}
                  LIVE
                </Badge>
              </div>
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs gap-1.5 rounded-full"
                onClick={() => onJoinMeeting?.(m)}
              >
                <Video className="w-3 h-3" />
                Join
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="px-5 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
              <span className="text-xs text-muted-foreground">Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-primary/60" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Start the conversation!</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Messages are automatically translated to each team member's preferred language.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Globe className="w-3 h-3" />
                  {profiles.filter((p) => p.is_active).map((p) => getLang(p.preferred_language || "en").flag).filter((v, i, a) => a.indexOf(v) === i).join(" ")}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              {groupedMessages.map((item, idx) => {
                if (item.type === "date" && item.date) {
                  return (
                    <div key={`date-${idx}`} className="flex items-center gap-3 py-4">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2">
                        {formatDateSeparator(item.date)}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  );
                }

                if (item.type === "message" && item.msg) {
                  const msg = item.msg;
                  const isMine = msg.sender_profile_id === myProfile?.id;
                  const displayText = getDisplayText(msg);
                  const isTranslated = !isMine && !showOriginal.has(msg.id) && msg.translations[myLang] && msg.original_language !== myLang;
                  const displayLang = isMine ? msg.original_language : (showOriginal.has(msg.id) ? msg.original_language : (msg.translations[myLang] ? myLang : msg.original_language));
                  const senderLangInfo = getLang(msg.original_language);

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "group flex gap-3 rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-muted/30",
                        item.isGrouped ? "mt-0" : "mt-3"
                      )}
                    >
                      {/* Avatar - only show for first in group */}
                      <div className="w-9 shrink-0">
                        {!item.isGrouped && (
                          <Avatar className="w-9 h-9">
                            <AvatarImage src={msg.sender?.avatar_url || ""} />
                            <AvatarFallback
                              className={cn("text-[11px] font-bold text-white", getAvatarColor(msg.sender?.full_name || "?"))}
                            >
                              {getInitials(msg.sender?.full_name || "?")}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Header - only for first in group */}
                        {!item.isGrouped && (
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-sm text-foreground">
                              {msg.sender?.full_name || "Unknown"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(msg.created_at), "h:mm a")}
                            </span>
                            {isMine && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5">
                                {senderLangInfo.flag}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Message Body */}
                        <div className="relative">
                          <p
                            className={cn(
                              "text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed",
                              isRtl(displayLang) && "text-right"
                            )}
                            dir={isRtl(displayLang) ? "rtl" : "ltr"}
                          >
                            {displayText}
                          </p>

                          {/* Translation indicator */}
                          {!isMine && msg.original_language !== myLang && msg.translations[myLang] && (
                            <button
                              onClick={() => toggleOriginal(msg.id)}
                              className="inline-flex items-center gap-1 mt-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Languages className="w-3 h-3" />
                              {showOriginal.has(msg.id) ? (
                                <span>Showing original ({senderLangInfo.flag} {senderLangInfo.name}) · Show translation</span>
                              ) : (
                                <span>Translated from {senderLangInfo.flag} {senderLangInfo.name} · Show original</span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Message actions (on hover) */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-0.5 pt-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Smile className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t border-border p-4 bg-card/50 backdrop-blur-sm">
        {/* Formatting toolbar */}
        <div className="flex items-center gap-0.5 mb-2">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Bold className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Italic className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <List className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Code className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <AtSign className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>

        {/* Input area */}
        <div className="relative rounded-xl border border-border bg-background focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message #${channelName}...`}
            className="min-h-[44px] max-h-32 resize-none border-0 focus-visible:ring-0 bg-transparent px-3 py-2.5 text-sm"
            rows={1}
            dir={isRtl(myLang) ? "rtl" : "ltr"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Smile className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1 ml-1">
                {myLangInfo.flag} {myLangInfo.name}
              </Badge>
            </div>

            <Button
              size="sm"
              className="h-8 px-3 gap-1.5 rounded-lg"
              onClick={handleSubmit}
              disabled={!input.trim() || isSending}
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Send
            </Button>
          </div>
        </div>

        {/* Typing indicator area */}
        <div className="h-4 mt-1">
          <p className="text-[10px] text-muted-foreground/60">
            {isSending && "Translating & sending..."}
          </p>
        </div>
      </div>
    </div>
  );
}
