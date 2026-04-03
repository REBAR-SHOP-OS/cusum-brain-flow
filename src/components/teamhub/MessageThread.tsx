import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { detectRtl } from "@/utils/textDirection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MentionMenu } from "@/components/chat/MentionMenu";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
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
  Download,
  
  Trash2,
  Reply,
  Forward,
  Mic,
  AudioLines,
  Square,
  ChevronDown,
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
import { downloadFile } from "@/lib/downloadUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import { primeMobileAudio } from "@/lib/audioPlayer";
import { getPublicFileUrl, fixChatFileUrl, parseAttachmentLinks, isImageUrl, isImageType } from "@/lib/chatFileUtils";

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
  onSend: (text: string, attachments?: ChatAttachment[], replyToId?: string | null) => void;
  activeMeetings?: TeamMeeting[];
  onStartMeeting?: () => void;
  onJoinMeeting?: (meeting: TeamMeeting) => void;
  readOnly?: boolean;
  onForward?: (msg: TeamMessage) => void;
  onLangChange?: (lang: string) => void;
  headerExtra?: React.ReactNode;
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

function isAudioFile(type: string) {
  return type.startsWith("audio/");
}

function isAudioUrl(url: string): boolean {
  return /\.(mp3|wav|ogg|webm|m4a|aac)(\?|$)/i.test(url);
}

function isVideoFile(type: string) {
  return type.startsWith("video/");
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
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
  readOnly = false,
  onForward,
  onLangChange,
  headerExtra,
}: MessageThreadProps) {
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<TeamMessage | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  

  // Voice recorder
  const voiceRecorder = useVoiceRecorder();

  const formatVoiceDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleVoiceSend = async () => {
    const blob = await voiceRecorder.stopRecording();
    if (!blob) return;

    setIsUploading(true);
    const sessionOk = await ensureSession();
    if (!sessionOk) { setIsUploading(false); return; }

    const fileName = `voice-${Date.now()}.webm`;
    const { error } = await supabase.storage.from("team-chat-files").upload(fileName, blob, { contentType: "audio/webm" });
    if (error) {
      toast.error("Failed to upload voice message");
      setIsUploading(false);
      return;
    }
    const publicUrl = getPublicFileUrl(fileName);
    onSend("🎤", [{ name: fileName, url: publicUrl, type: "audio/webm", size: blob.size }], replyTo?.id || null);
    setReplyTo(null);
    setIsUploading(false);
  };

  const DELETE_ADMINS = ["radin@rebar.shop", "sattar@rebar.shop", "neel@rebar.shop"];
  const canDelete = DELETE_ADMINS.includes(myProfile?.email ?? "");

  const handleDeleteMessage = async (msgId: string) => {
    const { error } = await supabase
      .from("team_messages")
      .delete()
      .eq("id", msgId);
    if (error) {
      toast.error("Failed to delete message");
    } else {
      toast.success("Message deleted");
    }
  };
  const { ensureSession } = useSessionGuard();
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());
  const [pendingFiles, setPendingFiles] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Voice input with multi-language support
  const LANG_TO_BCP47: Record<string, string> = {
    en: "en-US", fa: "fa-IR", ar: "ar-SA", es: "es-ES",
    fr: "fr-FR", hi: "hi-IN", zh: "zh-CN", de: "de-DE",
    tr: "tr-TR", pt: "pt-BR", ru: "ru-RU", ko: "ko-KR",
    ja: "ja-JP", ur: "ur-PK",
  };
  const [voiceLang, setVoiceLang] = useState(myLang || "en");
  const speech = useSpeechRecognition({
    onError: (err) => toast.error(err),
    lang: LANG_TO_BCP47[voiceLang] || "en-US",
  });

  // Append voice transcripts to input
  useEffect(() => {
    if (speech.fullTranscript) {
      setInput((prev) => {
        const space = prev && !prev.endsWith(" ") ? " " : "";
        return prev + space + speech.fullTranscript;
      });
      speech.clearTranscripts();
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
    onSend(trimmed || "📎", pendingFiles.length > 0 ? pendingFiles : undefined, replyTo?.id || null);
    setInput("");
    setPendingFiles([]);
    setReplyTo(null);
    setMentionOpen(false);
    textareaRef.current?.focus();
  };

  // Build a message map for reply lookups
  const messageMap = useMemo(() => {
    const map = new Map<string, TeamMessage>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  // Handle @mention detection in input
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursorPos = e.target.selectionStart || 0;
    const textBefore = val.slice(0, cursorPos);
    const atIdx = textBefore.lastIndexOf("@");

    if (atIdx >= 0 && (atIdx === 0 || textBefore[atIdx - 1] === " " || textBefore[atIdx - 1] === "\n")) {
      const filter = textBefore.slice(atIdx + 1);
      if (!filter.includes(" ") && filter.length < 30) {
        setMentionOpen(true);
        setMentionFilter(filter);
        setMentionStart(atIdx);
        setMentionIndex(0);
        return;
      }
    }
    setMentionOpen(false);
  };

  const handleMentionSelect = (item: { id: string; label: string }) => {
    const before = input.slice(0, mentionStart);
    const after = input.slice((textareaRef.current?.selectionStart || mentionStart + mentionFilter.length + 1));
    setInput(before + `@${item.label} ` + after);
    setMentionOpen(false);
    textareaRef.current?.focus();
  };

  // Render text with @mentions highlighted
  const renderMentionText = (text: string) => {
    const parts = text.split(/(@\S+)/g);
    const profileNames = new Set(profiles.map(p => p.full_name));
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        const name = part.slice(1);
        if (profileNames.has(name)) {
          return (
            <span key={i} className="inline-flex items-center px-1 py-0.5 rounded bg-primary/15 text-primary text-xs font-medium">
              {part}
            </span>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleEmojiSelect = (emoji: string) => {
    setInput((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const processFiles = async (files: FileList) => {
    if (!files.length) return;
    setIsUploading(true);
    const newAttachments: ChatAttachment[] = [];

    const sessionOk = await ensureSession();
    if (!sessionOk) {
      setIsUploading(false);
      return;
    }

    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 50MB)`);
        continue;
      }

      const path = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("team-chat-files")
        .upload(path, file);

      if (error) {
        toast.error(`Failed to upload ${file.name}: ${error.message}`);
        continue;
      }

      const publicUrl = getPublicFileUrl(path);

      newAttachments.push({
        name: file.name,
        url: publicUrl,
        type: file.type,
        size: file.size,
      });
    }

    setPendingFiles((prev) => [...prev, ...newAttachments]);
    setIsUploading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
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

    // Prime audio element synchronously during user gesture (silent WAV)
    const audio = primeMobileAudio();
    audioRef.current = audio;

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

      // Pause silent playback, swap to real source, replay
      audio.pause();
      audio.src = audioUrl;

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
    <div className="flex h-full flex-col bg-transparent">
      {/* Channel Header - hidden on mobile */}
      <div className="hidden md:flex items-center justify-between border-b border-white/10 bg-[rgba(15,23,42,0.38)] px-5 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <Hash className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-white">#{channelName}</h2>
              <Badge className="border-white/10 bg-white/5 text-[10px] font-medium text-slate-300 hover:bg-white/5">
                {memberCount} online
              </Badge>
            </div>
            {channelDescription && (
              <p className="mt-1 text-[11px] text-slate-400">{channelDescription}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerExtra}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
            onClick={onStartMeeting}
          >
            <Video className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile action bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[rgba(15,23,42,0.32)] px-3 py-2 backdrop-blur-sm md:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">#{channelName}</p>
          {channelDescription && (
            <p className="truncate text-[11px] text-slate-400">{channelDescription}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={onStartMeeting}
        >
          <Video className="h-4 w-4" />
        </Button>
      </div>

      {/* Active Meeting Banner */}
      {activeMeetings.length > 0 && (
        <div className="border-b border-white/10 bg-[linear-gradient(90deg,rgba(45,212,191,0.12),rgba(15,23,42,0.18))] px-4 py-3 md:px-5">
          {activeMeetings.map((m) => (
            <div key={m.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{m.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline" className="gap-1 border-white/10 bg-white/5 px-1.5 py-0 text-[9px] text-slate-200">
                      {m.meeting_type === "video" && <Video className="w-2.5 h-2.5" />}
                      {m.meeting_type === "audio" && <Phone className="w-2.5 h-2.5" />}
                      {m.meeting_type === "screen_share" && <MonitorUp className="w-2.5 h-2.5" />}
                      {m.meeting_type.replace("_", " ")}
                    </Badge>
                    <span className="text-[11px] text-emerald-300">Live now</span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="default"
                className="h-8 gap-1.5 rounded-full px-4 shadow-[0_10px_30px_-12px_rgba(45,212,191,0.65)]"
                onClick={() => onJoinMeeting?.(m)}
              >
                <Video className="w-3 h-3" />
                Join meeting
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="mx-auto w-full max-w-5xl px-3 py-4 md:px-5 md:py-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
              <span className="text-xs text-slate-400">Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-[26px] border border-white/10 bg-white/5">
                <MessageSquare className="h-7 w-7 text-primary/70" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Start the conversation</h3>
                <p className="mt-1 max-w-xs text-xs text-slate-400">
                  Messages are automatically translated to each team member&apos;s preferred language.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1 border-white/10 bg-white/5 text-[10px] text-slate-200">
                  <Globe className="h-3 w-3" />
                  {profiles.filter((p) => p.is_active).map((p) => getLang(p.preferred_language || "en").flag).filter((v, i, a) => a.indexOf(v) === i).join(" ")}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              {groupedMessages.map((item, idx) => {
                if (item.type === "date" && item.date) {
                  return (
                    <div key={`date-${idx}`} className="flex items-center gap-3 py-5">
                      <div className="h-px flex-1 bg-white/10" />
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                        {formatDateSeparator(item.date)}
                      </span>
                      <div className="h-px flex-1 bg-white/10" />
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
                        "group -mx-2 flex gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-white/[0.03] md:-mx-3 md:px-3",
                        item.isGrouped ? "mt-0" : "mt-4"
                      )}
                    >
                      {/* Avatar */}
                      <div className="w-10 shrink-0">
                        {!item.isGrouped && (
                          <Avatar className="h-10 w-10 border border-white/10 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.9)]">
                            <AvatarImage src={msg.sender?.avatar_url || ""} />
                            <AvatarFallback
                              className={cn("text-[11px] font-bold text-white", getAvatarColor(msg.sender?.full_name || "?"))}
                            >
                              {getInitials(msg.sender?.full_name || "?")}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 overflow-hidden">
                        {/* Header */}
                        {!item.isGrouped && (
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              {msg.sender?.full_name || "Unknown"}
                            </span>
                            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                              {format(new Date(msg.created_at), "h:mm a")}
                            </span>
                            <Badge variant="outline" className="gap-1 border-white/10 bg-white/5 px-1.5 py-0 text-[9px] text-slate-300">
                              {senderLangInfo.flag} {getLang(displayLang).name}
                            </Badge>
                            {isTranslated && (
                              <Badge variant="outline" className="border-primary/20 bg-primary/10 px-1.5 py-0 text-[9px] text-primary">
                                translated
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Reply quote */}
                        {msg.reply_to_id && (() => {
                          const repliedMsg = messageMap.get(msg.reply_to_id!);
                          if (!repliedMsg) return null;
                          const { cleanText: replyClean, parsedAttachments: replyParsed } = parseAttachmentLinks(repliedMsg.original_text);
                          const replyAttachments = [
                            ...((repliedMsg.attachments || []) as ChatAttachment[]).map(a => ({ name: a.name, url: fixChatFileUrl(a.url), type: a.type || "" })),
                            ...replyParsed.map(a => ({ name: a.name, url: a.url, type: "" })),
                          ];
                          const seenReply = new Set<string>();
                          const uniqueReplyAtts = replyAttachments.filter(a => { if (seenReply.has(a.url)) return false; seenReply.add(a.url); return true; });
                          const replyImages = uniqueReplyAtts.filter(a => isImageType(a.type) || isImageUrl(a.url) || isImageUrl(a.name));
                          const previewText = replyClean.trim() || (replyImages.length > 0 ? "📷 Photo" : repliedMsg.original_text.slice(0, 80));
                          return (
                            <div className="mb-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                              <div className="w-1 self-stretch rounded-full bg-primary/40" />
                              {replyImages.length > 0 && (
                                <img src={replyImages[0].url} alt="" className="h-9 w-9 flex-shrink-0 rounded-xl border border-white/10 object-cover" />
                              )}
                              <div className="min-w-0">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                                  {repliedMsg.sender?.full_name || "Unknown"}
                                </span>
                                <p className="max-w-[320px] truncate text-[11px] text-slate-400">
                                  {previewText.slice(0, 80)}{previewText.length > 80 ? "…" : ""}
                                </p>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Message Body */}
                        {(() => {
                          const { cleanText, parsedAttachments } = parseAttachmentLinks(displayText);
                          const allAttachments = [
                            ...attachments.map(a => ({ name: a.name, url: fixChatFileUrl(a.url), type: a.type || "" })),
                            ...parsedAttachments.map(a => ({ name: a.name, url: a.url, type: "" })),
                          ];
                          // Deduplicate by URL
                          const seen = new Set<string>();
                          const uniqueAttachments = allAttachments.filter(a => {
                            if (seen.has(a.url)) return false;
                            seen.add(a.url);
                            return true;
                          });

                          return (
                            <div className="relative rounded-3xl border border-white/8 bg-[rgba(15,23,42,0.42)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                              {cleanText && (
                                <p
                                  className={cn(
                                    "whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-slate-100",
                                    detectRtl(cleanText) && "text-right"
                                  )}
                                  dir={detectRtl(cleanText) ? "rtl" : "ltr"}
                                >
                                  {renderMentionText(cleanText)}
                                </p>
                              )}

                              {/* Attachments: images, videos, files */}
                              {uniqueAttachments.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {uniqueAttachments.map((att, i) => {
                                    const isImg = isImageFile(att.type) || isImageUrl(att.url) || isImageUrl(att.name);
                                    const isVid = isVideoFile(att.type) || isVideoUrl(att.url) || isVideoUrl(att.name);
                                    const isAud = isAudioFile(att.type) || isAudioUrl(att.url) || isAudioUrl(att.name);

                                    if (isImg) {
                                      return (
                                        <div key={i} className="flex flex-col gap-1.5">
                                          <img
                                            src={att.url}
                                            alt={att.name}
                                            className="max-h-[220px] max-w-[280px] cursor-pointer rounded-2xl border border-white/10 object-cover transition-opacity hover:opacity-90"
                                            onClick={() => window.open(att.url, "_blank")}
                                          />
                                          <button
                                            onClick={() => downloadFile(att.url, att.name)}
                                            className="inline-flex w-fit items-center gap-1 text-[10px] text-slate-400 transition-colors hover:text-primary"
                                            title="Download"
                                          >
                                            <Download className="w-3 h-3" />
                                            <span>Download</span>
                                          </button>
                                        </div>
                                      );
                                    }

                                    if (isVid) {
                                      return (
                                        <div key={i} className="flex flex-col gap-1.5">
                                          <video
                                            src={att.url}
                                            controls
                                            preload="metadata"
                                            className="max-h-[240px] max-w-[320px] rounded-2xl border border-white/10"
                                          />
                                          <button
                                            onClick={() => downloadFile(att.url, att.name)}
                                            className="inline-flex w-fit items-center gap-1 text-[10px] text-slate-400 transition-colors hover:text-primary"
                                            title="Download"
                                          >
                                            <Download className="w-3 h-3" />
                                            <span>Download</span>
                                          </button>
                                        </div>
                                      );
                                    }

                                    if (isAud) {
                                      return (
                                        <div key={i} className="flex max-w-[300px] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                                          <Mic className="h-4 w-4 shrink-0 text-primary" />
                                          <audio controls preload="metadata" className="h-8 w-full min-w-0" src={att.url} />
                                          <button
                                            onClick={() => downloadFile(att.url, att.name || "voice-message.webm")}
                                            className="shrink-0 rounded-md p-1 transition-colors hover:bg-white/10"
                                            title="Download"
                                          >
                                            <Download className="h-3.5 w-3.5 text-slate-400" />
                                          </button>
                                        </div>
                                      );
                                    }

                                    return (
                                      <button
                                        key={i}
                                        onClick={() => downloadFile(att.url, att.name)}
                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-white/[0.06]"
                                      >
                                        <FileText className="h-3.5 w-3.5 text-primary" />
                                        <span className="max-w-[140px] truncate">{att.name}</span>
                                        <Download className="h-3.5 w-3.5 text-slate-400" />
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Translation indicator */}
                              {!isMine && msg.original_language !== myLang && msg.translations[myLang] && (
                                <button
                                  onClick={() => toggleOriginal(msg.id)}
                                  className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-400 transition-colors hover:text-primary"
                                >
                                  <Languages className="h-3 w-3" />
                                  {showOriginal.has(msg.id) ? (
                                    <span>Showing original ({senderLangInfo.flag} {senderLangInfo.name}) · Show translation</span>
                                  ) : (
                                    <span>Translated from {senderLangInfo.flag} {senderLangInfo.name} · Show original</span>
                                  )}
                                </button>
                              )}
                            </div>
                          );
                        })()}

                        {/* Message actions (on hover) */}
                        <div className="flex items-start gap-0.5 pt-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => handleTTS(displayText, msg.id)}
                            className={cn(
                              "rounded-lg p-1.5 transition-colors",
                              playingMsgId === msg.id
                                ? "bg-primary/10 text-primary"
                                : "text-slate-400 hover:bg-white/10 hover:text-white"
                            )}
                            title={playingMsgId === msg.id ? "Stop" : "Listen"}
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                          {!readOnly && (
                            <button
                              onClick={() => { setReplyTo(msg); textareaRef.current?.focus(); }}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                              title="Reply"
                            >
                              <Reply className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onForward && (
                            <button
                              onClick={() => onForward(msg)}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                              title="Forward"
                            >
                              <Forward className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <ContentActions content={msg.original_text} size="xs" source="teamhub" sourceRef={msg.id} />
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-destructive/10 hover:text-destructive"
                              title="Delete for everyone"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
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
      {readOnly ? (
        <div className="border-t border-white/10 bg-[rgba(15,23,42,0.38)] p-3 backdrop-blur-sm md:p-4 safe-area-bottom">
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-400">
            <Hash className="h-3.5 w-3.5" />
            <span>This channel is read-only</span>
          </div>
        </div>
      ) : (
      <div className="border-t border-white/10 bg-[rgba(15,23,42,0.42)] p-2 backdrop-blur-sm md:p-4 safe-area-bottom">
        {/* Pending file previews */}
        {pendingFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {pendingFiles.map((f, i) => (
              <div key={i} className="inline-flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200">
                {isImageFile(f.type) ? <ImageIcon className="h-3 w-3 text-primary" /> : <FileText className="h-3 w-3 text-primary" />}
                <span className="max-w-[110px] truncate">{f.name}</span>
                <button onClick={() => removePendingFile(i)} className="text-slate-400 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Reply banner */}
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <Reply className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{replyTo.sender?.full_name || "Unknown"}</span>
              <p className="truncate text-[11px] text-slate-400">{replyTo.original_text.slice(0, 80)}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="shrink-0 text-slate-400 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Input area */}
        <div className="relative rounded-[24px] border border-white/10 bg-[rgba(2,6,23,0.45)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20">
          {/* Mention menu */}
          <MentionMenu
            isOpen={mentionOpen}
            filter={mentionFilter}
            selectedIndex={mentionIndex}
            onSelect={handleMentionSelect}
            onClose={() => setMentionOpen(false)}
          />

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            placeholder={`Message #${channelName}...`}
            className="min-h-[42px] max-h-32 resize-none border-0 bg-transparent px-4 py-3 pb-11 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-0 md:min-h-[46px]"
            rows={1}
            dir="auto"
            onKeyDown={(e) => {
              if (mentionOpen) {
                if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => i + 1); return; }
                if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => Math.max(0, i - 1)); return; }
                if (e.key === "Escape") { e.preventDefault(); setMentionOpen(false); return; }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            onPaste={(e) => {
              const files = e.clipboardData?.files;
              if (files && files.length > 0) {
                e.preventDefault();
                processFiles(files);
              }
            }}
          />

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-2 pb-2">
            {voiceRecorder.isRecording ? (
              /* Recording state UI */
              <>
                <div className="flex flex-1 items-center gap-2">
                  <div className="flex items-center gap-1.5 text-destructive animate-pulse">
                    <div className="h-2 w-2 rounded-full bg-destructive" />
                    <span className="text-xs font-medium">{formatVoiceDuration(voiceRecorder.duration)}</span>
                  </div>
                  <span className="text-xs text-slate-400">Recording...</span>
                  <button
                    type="button"
                    onClick={voiceRecorder.cancelRecording}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  size="sm"
                  className="h-9 gap-1.5 rounded-full px-3"
                  onClick={handleVoiceSend}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                  <span className="hidden md:inline">Stop & Send</span>
                </Button>
              </>
            ) : (
              /* Normal composer UI */
              <>
                <div className="flex items-center gap-1">
                  <EmojiPicker onSelect={handleEmojiSelect} disabled={isSending} />
                  <VoiceInputButton
                    isListening={speech.isListening}
                    isSupported={speech.isSupported}
                    onToggle={speech.isListening ? speech.stop : speech.start}
                    disabled={isSending}
                    lang={voiceLang}
                    onLangChange={(l) => { if (speech.isListening) speech.stop(); setVoiceLang(l); }}
                    languages={LANG_LABELS}
                  />
                  <button
                    type="button"
                    onClick={() => voiceRecorder.startRecording()}
                    disabled={isSending || isUploading}
                    className={cn(
                      "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-primary/10 p-2.5 text-primary transition-colors hover:bg-primary/20 md:min-h-0 md:min-w-0 md:p-2",
                      (isSending || isUploading) && "cursor-not-allowed opacity-50"
                    )}
                    title="Record voice message"
                  >
                    <AudioLines className="h-5 w-5" />
                  </button>
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
                      "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white md:min-h-0 md:min-w-0 md:p-2",
                      (isSending || isUploading) && "cursor-not-allowed opacity-50"
                    )}
                    title="Attach file"
                  >
                    {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                  </button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="ml-1 hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-slate-300 transition-colors hover:bg-white/[0.08] sm:inline-flex"
                        title="Select language"
                      >
                        <span className="text-sm leading-none">{myLangInfo.flag}</span>
                        <span>{myLangInfo.name}</span>
                        <ChevronDown className="h-2.5 w-2.5 text-slate-500" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="end" className="max-h-64 w-48 overflow-y-auto p-1">
                      {Object.entries(LANG_LABELS).map(([code, info]) => (
                        <button
                          key={code}
                          onClick={() => onLangChange?.(code)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                            code === myLang
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-foreground hover:bg-muted/60"
                          )}
                        >
                          <span className="text-base leading-none">{info.flag}</span>
                          <span className="truncate">{info.name}</span>
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                </div>

                <Button
                  size="sm"
                  className="h-9 gap-1.5 rounded-full px-3 shadow-[0_12px_30px_-16px_rgba(45,212,191,0.6)] md:w-auto"
                  onClick={handleSubmit}
                  disabled={(!input.trim() && pendingFiles.length === 0) || isSending}
                >
                  {isSending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden md:inline">Send</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Status area */}
        <div className="mt-1 h-4">
          <p className="text-[10px] text-slate-500">
            {isSending && "Translating & sending..."}
            {voiceRecorder.isRecording && !isSending && "Recording voice message..."}
            {speech.isListening && !isSending && !voiceRecorder.isRecording && "Listening..."}
            {speech.interimText && !isSending && ` ${speech.interimText}`}
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
