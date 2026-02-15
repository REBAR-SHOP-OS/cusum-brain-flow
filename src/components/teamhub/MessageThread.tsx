import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Loader2,
  Globe,
  Hash,
  Languages,
  MessageSquare,
  Video,
  Phone,
  MonitorUp,
  Paperclip,
  Volume2,
  FileText,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { EmojiPicker } from "@/components/chat/EmojiPicker";
import { VoiceInputButton } from "@/components/chat/VoiceInputButton";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { ContentActions } from "@/components/shared/ContentActions";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import type { TeamMessage, ChatAttachment } from "@/hooks/useTeamChat";
import type { Profile } from "@/hooks/useProfiles";
import type { TeamMeeting } from "@/hooks/useTeamMeetings";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  onSend: (text: string, attachments?: ChatAttachment[]) => void;
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

function isImageFile(type: string) {
  return type.startsWith("image/");
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
  const [pendingFiles, setPendingFiles] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Voice input
  const speech = useSpeechRecognition({
    onError: (err) => toast.error(err),
  });

  // Append voice transcripts to input
  useEffect(() => {
    if (speech.fullTranscript) {
      setInput((prev) => {
        const space = prev && !prev.endsWith(" ") ? " " : "";
        return prev + space + speech.fullTranscript;
      });
      speech.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.fullTranscript]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed && pendingFiles.length === 0) return;
    onSend(trimmed || "📎", pendingFiles.length > 0 ? pendingFiles : undefined);
    setInput("");
    setPendingFiles([]);
    textareaRef.current?.focus();
  };

  const handleEmojiSelect = (emoji: string) => {
    setInput((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAttachments: ChatAttachment[] = [];

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }

      const path = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("team-chat-files")
        .upload(path, file);

      if (error) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("team-chat-files")
        .getPublicUrl(path);

      newAttachments.push({
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
        size: file.size,
      });
    }

    setPendingFiles((prev) => [...prev, ...newAttachments]);
    setIsUploading(false);
    e.target.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTTS = useCallback(async (text: string, msgId: string) => {
    if (playingMsgId === msgId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingMsgId(null);
      return;
    }

    setPlayingMsgId(msgId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text }),
        }
      );

      if (!response.ok) throw new Error("TTS failed");

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingMsgId(null);
        audioRef.current = null;
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch {
      toast.error("Failed to play audio");
      setPlayingMsgId(null);
    }
  }, [playingMsgId]);

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
      if (!lastDate || !isSameDay(lastDate, msgDate)) {
        groups.push({ type: "date", date: msgDate });
        lastSenderId = null;
      }
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
      {/* Channel Header - hidden on mobile */}
      <div className="hidden md:flex border-b border-border px-4 lg:px-5 py-3 items-center justify-between bg-card/50 backdrop-blur-sm">
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
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={onStartMeeting}>
            <Video className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Mobile action bar */}
      <div className="flex md:hidden items-center px-3 py-1.5 border-b border-border bg-card/30">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onStartMeeting}>
          <Video className="w-4 h-4 text-muted-foreground" />
        </Button>
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
                  const attachments = msg.attachments || [];

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "group flex gap-3 rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-muted/30",
                        item.isGrouped ? "mt-0" : "mt-3"
                      )}
                    >
                      {/* Avatar */}
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
                        {/* Header */}
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

                          {/* Attachments */}
                          {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {attachments.map((att, i) => (
                                <a
                                  key={i}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-xs text-foreground/80"
                                >
                                  {isImageFile(att.type) ? (
                                    <ImageIcon className="w-3.5 h-3.5 text-primary" />
                                  ) : (
                                    <FileText className="w-3.5 h-3.5 text-primary" />
                                  )}
                                  <span className="truncate max-w-[120px]">{att.name}</span>
                                </a>
                              ))}
                            </div>
                          )}

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
                        <button
                          onClick={() => handleTTS(displayText, msg.id)}
                          className={cn(
                            "p-1 rounded-md transition-colors",
                            playingMsgId === msg.id
                              ? "text-primary bg-primary/10"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                          title={playingMsgId === msg.id ? "Stop" : "Listen"}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <ContentActions content={msg.original_text} size="xs" source="teamhub" sourceRef={msg.id} />
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
      <div className="border-t border-border p-2 md:p-4 bg-card/50 backdrop-blur-sm safe-area-bottom">
        {/* Pending file previews */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {pendingFiles.map((f, i) => (
              <div key={i} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-muted/30 text-xs">
                {isImageFile(f.type) ? <ImageIcon className="w-3 h-3 text-primary" /> : <FileText className="w-3 h-3 text-primary" />}
                <span className="truncate max-w-[100px]">{f.name}</span>
                <button onClick={() => removePendingFile(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="relative rounded-xl border border-border bg-background focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message #${channelName}...`}
            className="min-h-[40px] md:min-h-[44px] max-h-32 resize-none border-0 focus-visible:ring-0 bg-transparent px-3 py-2 md:py-2.5 text-sm"
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
          <div className="flex items-center justify-between px-2 pb-1.5 md:pb-2">
            <div className="flex items-center gap-0.5">
              <EmojiPicker onSelect={handleEmojiSelect} disabled={isSending} />
              <VoiceInputButton
                isListening={speech.isListening}
                isSupported={speech.isSupported}
                onToggle={speech.isListening ? speech.stop : speech.start}
                disabled={isSending}
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending || isUploading}
                className={cn(
                  "p-2 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  (isSending || isUploading) && "opacity-50 cursor-not-allowed"
                )}
                title="Attach file"
              >
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
              </button>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1 hidden sm:inline-flex ml-1">
                {myLangInfo.flag} {myLangInfo.name}
              </Badge>
            </div>

            <Button
              size="sm"
              className="h-8 w-8 md:w-auto md:px-3 gap-1.5 rounded-lg p-0 md:p-2"
              onClick={handleSubmit}
              disabled={(!input.trim() && pendingFiles.length === 0) || isSending}
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline">Send</span>
            </Button>
          </div>
        </div>

        {/* Status area */}
        <div className="h-3 md:h-4 mt-0.5 md:mt-1">
          <p className="text-[10px] text-muted-foreground/60">
            {isSending && "Translating & sending..."}
            {speech.isListening && !isSending && "🎙️ Listening..."}
            {speech.interimText && !isSending && ` ${speech.interimText}`}
          </p>
        </div>
      </div>
    </div>
  );
}
