import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { detectRtl } from "@/utils/textDirection";
import { useNavigate } from "react-router-dom";
import {
  Minus, X, Maximize2, Send, Hash, Users, Paperclip, FileIcon, Loader2, Download, Copy,
  Reply, Forward, Trash2, Volume2, Languages, Mic, AudioLines, Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadFile } from "@/lib/downloadUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTeamMessages, useSendMessage, useMyProfile, type TeamMessage, type ChatAttachment } from "@/hooks/useTeamChat";
import { useProfiles } from "@/hooks/useProfiles";
import { useOpenDM } from "@/hooks/useChannelManagement";
import { useDockChat } from "@/contexts/DockChatContext";
import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage } from "@/lib/storageUpload";
import { toast } from "sonner";
import { getPublicFileUrl, fixChatFileUrl, isImageUrl, parseAttachmentLinks, resolveMessageContent } from "@/lib/chatFileUtils";
import { InlineFileLink } from "@/components/pipeline/InlineFileLink";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import { MentionMenu } from "@/components/chat/MentionMenu";
import { EmojiPicker } from "@/components/chat/EmojiPicker";
import { VoiceInputButton } from "@/components/chat/VoiceInputButton";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { primeMobileAudio } from "@/lib/audioPlayer";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface PendingFile {
  file: File;
  name: string;
  size: number;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
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

function formatDateSeparator(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

function isAudioUrl(url: string): boolean {
  return /\.(mp3|wav|ogg|webm|m4a|aac)(\?|$)/i.test(url);
}

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
  ru: { name: "Русский", flag: "🇷🇺" },
};

const LANG_TO_BCP47: Record<string, string> = {
  en: "en-US", fa: "fa-IR", ar: "ar-SA", es: "es-ES",
  fr: "fr-FR", hi: "hi-IN", zh: "zh-CN", de: "de-DE",
  tr: "tr-TR", ru: "ru-RU",
};

const DELETE_ADMINS = ["radin@rebar.shop", "sattar@rebar.shop", "neel@rebar.shop"];

interface DockChatBoxProps {
  channelId: string;
  channelName: string;
  channelType: "dm" | "group";
  minimized: boolean;
  style?: React.CSSProperties;
}

export function DockChatBox({ channelId, channelName, channelType, minimized, style }: DockChatBoxProps) {
  const navigate = useNavigate();
  const { closeChat, toggleMinimize } = useDockChat();
  const { ensureSession } = useSessionGuard();
  const { messages, isLoading } = useTeamMessages(channelId);
  const { profiles } = useProfiles();
  const myProfile = useMyProfile();
  const sendMutation = useSendMessage();
  const [inputText, setInputText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Reply ---
  const [replyTo, setReplyTo] = useState<TeamMessage | null>(null);

  // --- @Mention ---
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);

  // --- Translation toggle ---
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());

  // --- TTS ---
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Voice recorder ---
  const voiceRecorder = useVoiceRecorder();

  // --- Voice input (speech-to-text) ---
  const myLang = myProfile?.preferred_language || "en";
  const [voiceLang, setVoiceLang] = useState(myLang);
  const speech = useSpeechRecognition({
    onError: (err) => toast.error(err),
    lang: LANG_TO_BCP47[voiceLang] || "en-US",
  });

  // Append voice transcripts to input
  useEffect(() => {
    if (speech.fullTranscript) {
      setInputText((prev) => {
        const space = prev && !prev.endsWith(" ") ? " " : "";
        return prev + space + speech.fullTranscript;
      });
      speech.clearTranscripts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.fullTranscript]);

  // --- Forward state ---
  const [forwardMsg, setForwardMsg] = useState<TeamMessage | null>(null);

  // --- Drag state ---
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    if (minimized) setDragOffset({ x: 0, y: 0 });
  }, [minimized]);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, offsetX: dragOffset.x, offsetY: dragOffset.y };

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      setDragOffset({
        x: dragStart.current.offsetX + (ev.clientX - dragStart.current.mouseX),
        y: dragStart.current.offsetY + (ev.clientY - dragStart.current.mouseY),
      });
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [dragOffset.x, dragOffset.y]);

  const stopDragPropagation = useCallback((e: React.MouseEvent) => { e.stopPropagation(); }, []);

  const targetLangs = useMemo(() => {
    const langs = new Set<string>();
    for (const p of profiles) if (p.is_active && p.preferred_language) langs.add(p.preferred_language);
    return [...langs];
  }, [profiles]);

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  // Message map for reply lookups
  const messageMap = useMemo(() => {
    const map = new Map<string, TeamMessage>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  useEffect(() => {
    if (!minimized) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, minimized]);

  const grouped = useMemo(() => {
    return messages.reduce((acc, msg) => {
      const d = new Date(msg.created_at).toDateString();
      const last = acc[acc.length - 1];
      if (!last || last.date !== d) {
        acc.push({ date: d, dateLabel: formatDateSeparator(msg.created_at), msgs: [msg] });
      } else {
        last.msgs.push(msg);
      }
      return acc;
    }, [] as { date: string; dateLabel: string; msgs: typeof messages }[]);
  }, [messages]);

  const canDelete = DELETE_ADMINS.includes(myProfile?.email ?? "");

  // --- Handlers ---

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid: PendingFile[] = [];
    for (const f of arr) {
      if (f.size > MAX_FILE_SIZE) { toast.error(`File "${f.name}" exceeds 50MB limit`); continue; }
      valid.push({ file: f, name: f.name, size: f.size });
    }
    if (valid.length) setPendingFiles((prev) => [...prev, ...valid]);
  }, []);

  const removeFile = (idx: number) => setPendingFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }, [addFiles]);
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }, [addFiles]);

  const uploadFiles = async (): Promise<Array<{ name: string; url: string; type: string; size: number }>> => {
    const sessionOk = await ensureSession();
    if (!sessionOk) throw new Error("Session expired — please log in again");
    const results: Array<{ name: string; url: string; type: string; size: number }> = [];
    for (const pf of pendingFiles) {
      const path = `chat-uploads/${channelId}/${Date.now()}-${pf.name}`;
      const { error } = await uploadToStorage("team-chat-files", path, pf.file);
      if (error) throw new Error(`Upload failed for ${pf.name}: ${error.message}`);
      results.push({ name: pf.name, url: getPublicFileUrl(path), type: pf.file.type, size: pf.size });
    }
    return results;
  };

  const handleSend = async () => {
    if ((!inputText.trim() && pendingFiles.length === 0) || !myProfile) return;
    const text = inputText.trim();
    setInputText("");

    try {
      let uploadedAttachments: Array<{ name: string; url: string; type: string; size: number }> = [];
      if (pendingFiles.length > 0) {
        setUploading(true);
        uploadedAttachments = await uploadFiles();
        setPendingFiles([]);
        setUploading(false);
      }

      // Send clean text only — attachments go through the structured field
      const msgText = text || (uploadedAttachments.length > 0 ? "📎" : "");
      if (!msgText && uploadedAttachments.length === 0) return;

      await sendMutation.mutateAsync({
        channelId,
        senderProfileId: myProfile.id,
        text: msgText,
        senderLang: myLang,
        targetLangs,
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
        replyToId: replyTo?.id || null,
      });
      setReplyTo(null);
      setMentionOpen(false);
    } catch (err: any) {
      setUploading(false);
      toast.error("Failed to send", { description: err.message });
    }
  };

  // --- Voice message send ---
  const handleVoiceSend = async () => {
    const blob = await voiceRecorder.stopRecording();
    if (!blob || !myProfile) return;
    setUploading(true);
    const sessionOk = await ensureSession();
    if (!sessionOk) { setUploading(false); return; }
    const fileName = `voice-${Date.now()}.webm`;
    const { error } = await supabase.storage.from("team-chat-files").upload(fileName, blob, { contentType: "audio/webm" });
    if (error) { toast.error("Failed to upload voice message"); setUploading(false); return; }
    const publicUrl = getPublicFileUrl(fileName);
    await sendMutation.mutateAsync({
      channelId,
      senderProfileId: myProfile.id,
      text: "🎤",
      senderLang: myLang,
      targetLangs,
      attachments: [{ name: fileName, url: publicUrl, type: "audio/webm", size: blob.size }],
      replyToId: replyTo?.id || null,
    });
    setReplyTo(null);
    setUploading(false);
  };

  // --- Delete message ---
  const handleDeleteMessage = async (msgId: string) => {
    const { error } = await (supabase as any).from("team_messages").delete().eq("id", msgId);
    if (error) toast.error("Failed to delete message");
    else toast.success("Message deleted");
  };

  // --- TTS ---
  const handleTTS = useCallback(async (text: string, msgId: string) => {
    if (playingMsgId === msgId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingMsgId(null);
      return;
    }
    setPlayingMsgId(msgId);
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
      audio.pause();
      audio.src = audioUrl;
      audio.onended = () => { setPlayingMsgId(null); audioRef.current = null; URL.revokeObjectURL(audioUrl); };
      await audio.play();
    } catch {
      toast.error("Failed to play audio");
      setPlayingMsgId(null);
    }
  }, [playingMsgId]);

  // --- Forward ---
  const openDMMutation = useOpenDM();
  const forwardMembers = useMemo(() =>
    profiles.filter(p => p.email?.endsWith("@rebar.shop") && p.id !== myProfile?.id),
    [profiles, myProfile]
  );

  const handleForwardToMember = async (profileId: string) => {
    if (!forwardMsg || !myProfile) return;
    try {
      const result = await openDMMutation.mutateAsync({ targetProfileId: profileId });
      if (result?.id) {
        await sendMutation.mutateAsync({
          channelId: result.id,
          senderProfileId: myProfile.id,
          text: `↪️ Forwarded from ${forwardMsg.sender?.full_name || "Unknown"}:\n${forwardMsg.original_text}`,
          senderLang: myLang,
          targetLangs,
          attachments: forwardMsg.attachments || [],
        });
        toast.success("Message forwarded");
        setForwardMsg(null);
      }
    } catch {
      toast.error("Failed to forward");
    }
  };

  // --- @Mention handler ---
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
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
    const before = inputText.slice(0, mentionStart);
    const after = inputText.slice((textareaRef.current?.selectionStart || mentionStart + mentionFilter.length + 1));
    setInputText(before + `@${item.label} ` + after);
    setMentionOpen(false);
    textareaRef.current?.focus();
  };

  const renderMentionText = (text: string) => {
    // Safer mention regex: only match @Name patterns where Name is a known profile
    const profileNames = new Set(profiles.map(p => p.full_name));
    const mentionPattern = /@([\w\s]+?)(?=\s@|\s*$|[.,!?;:])/g;
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    while ((match = mentionPattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (profileNames.has(name)) {
        if (match.index > lastIndex) {
          result.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
        }
        result.push(
          <span key={`m-${match.index}`} className="inline px-0.5 rounded bg-primary/15 text-primary text-[10px] font-medium">
            @{name}
          </span>
        );
        lastIndex = match.index + match[0].length;
      }
    }
    if (lastIndex < text.length) {
      result.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }
    return result.length > 0 ? result : [<span key="full">{text}</span>];
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  // --- Translation toggle ---
  const toggleOriginal = (msgId: string) => {
    setShowOriginal((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const getDisplayText = (msg: TeamMessage) => {
    if (msg.sender_profile_id === myProfile?.id) return msg.original_text;
    if (showOriginal.has(msg.id)) return msg.original_text;
    if (msg.translations[myLang]) return msg.translations[myLang];
    return msg.original_text;
  };

  const formatVoiceDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const isBusy = uploading || sendMutation.isPending;

  const headerProfile = useMemo(() => {
    if (channelType === "dm") {
      const otherSenderId = messages.find((m) => m.sender_profile_id !== myProfile?.id)?.sender_profile_id;
      if (otherSenderId) return profileMap.get(otherSenderId) || null;
      return profiles.find((p) => p.id !== myProfile?.id && channelName.includes(p.full_name)) || null;
    }
    return null;
  }, [channelType, messages, myProfile, profileMap, profiles, channelName]);

  const headerName = channelName;
  const headerInitials = getInitials(headerName);
  const headerColor = getAvatarColor(headerName);

  const containerStyle: React.CSSProperties = { ...style, transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` };

  // Forward members list is computed via forwardMembers memo above

  // --- Minimized state ---
  if (minimized) {
    return (
      <div style={style} className="fixed bottom-0 z-[9998] w-[280px] cursor-pointer pointer-events-auto" onClick={() => toggleMinimize(channelId)}>
        <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-t-xl shadow-lg">
          <div className="relative shrink-0">
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold", headerColor)}>{headerInitials}</div>
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border-2 border-background rounded-full" />
          </div>
          <span className="text-xs font-semibold text-foreground truncate flex-1">{channelName}</span>
          <button className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground" onClick={(e) => { e.stopPropagation(); closeChat(channelId); }}>
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={containerStyle}
      className={cn(
        "fixed bottom-0 z-[9998] w-[320px] flex flex-col bg-background border border-border rounded-t-xl shadow-2xl transition-colors pointer-events-auto",
        dragOver && "ring-2 ring-primary border-primary"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div
        className={cn("flex items-center gap-2.5 px-3 py-2.5 bg-background border-b border-border rounded-t-xl", isDragging.current ? "cursor-grabbing" : "cursor-grab")}
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="relative shrink-0">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold", headerColor)}>
            {headerProfile?.avatar_url ? (
              <img src={headerProfile.avatar_url} alt={headerName} className="w-full h-full rounded-full object-cover" />
            ) : headerInitials}
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-foreground truncate leading-tight">{channelName}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">{channelType === "group" ? "Group Channel" : "Online"}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0" onMouseDown={stopDragPropagation}>
          <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground" onClick={() => { closeChat(channelId); navigate("/team-hub"); }} title="Open full Team Hub">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground" onClick={() => toggleMinimize(channelId)} title="Minimize">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground" onClick={() => closeChat(channelId)} title="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="h-[300px] px-3 py-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No messages yet</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {grouped.map((group) => (
              <div key={group.date}>
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-muted-foreground font-medium px-1 shrink-0">{group.dateLabel}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {group.msgs.map((msg, idx) => {
                  const sender = profileMap.get(msg.sender_profile_id);
                  const isMe = msg.sender_profile_id === myProfile?.id;
                  const displayText = getDisplayText(msg);
                  const prevMsg = group.msgs[idx - 1];
                  const isFirstInSequence = !prevMsg || prevMsg.sender_profile_id !== msg.sender_profile_id;

                  return (
                    <div
                      key={msg.id}
                      className={cn("group flex gap-1.5 w-full", isMe ? "flex-row-reverse" : "flex-row", isFirstInSequence ? "mt-2" : "mt-0.5")}
                    >
                      {!isMe && (
                        <div className="w-6 shrink-0 self-end">
                          {isFirstInSequence && (
                            <Avatar className="w-6 h-6">
                              <AvatarImage src={sender?.avatar_url || ""} />
                              <AvatarFallback className={cn("text-[8px] font-bold text-white", getAvatarColor(sender?.full_name || "?"))}>
                                {getInitials(sender?.full_name || "?")}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      )}

                      <div className={cn("flex flex-col max-w-[75%] overflow-x-hidden", isMe ? "items-end" : "items-start")}>
                        {!isMe && isFirstInSequence && channelType === "group" && (
                          <span className="text-[10px] font-semibold text-muted-foreground mb-0.5 px-1">{sender?.full_name || "Unknown"}</span>
                        )}

                        {/* Reply quote */}
                        {msg.reply_to_id && (() => {
                          const repliedMsg = messageMap.get(msg.reply_to_id!);
                          if (!repliedMsg) return null;
                          const { cleanText: replyClean } = parseAttachmentLinks(repliedMsg.original_text);
                          const previewText = replyClean.trim() || repliedMsg.original_text.slice(0, 60);
                          return (
                            <div className="mb-0.5 pl-2 border-l-2 border-primary/40 py-0.5 rounded-sm bg-muted/30 max-w-full">
                              <span className="text-[9px] font-semibold text-primary/80">{repliedMsg.sender?.full_name || profileMap.get(repliedMsg.sender_profile_id)?.full_name || "Unknown"}</span>
                              <p className="text-[10px] text-muted-foreground truncate">{previewText.slice(0, 60)}</p>
                            </div>
                          );
                        })()}

                        {/* Bubble */}
                        {(() => {
                          // Always resolve attachments from original_text + structured attachments
                          // Never from translated text to avoid translation breaking file links
                          const { cleanText: originalClean, allAttachments: uniqueAttachments } = resolveMessageContent(msg.original_text, msg.attachments);
                          
                          // For display text, strip attachment markdown from the translated/display version too
                          const { cleanText: displayClean } = parseAttachmentLinks(displayText);
                          const visibleText = displayClean.trim();
                          const hasText = visibleText.length > 0 && visibleText !== "📎" && visibleText !== "🎤";

                          return (
                            <>
                              {hasText && (
                                <div
                                  className={cn(
                                    "px-3 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-words overflow-hidden min-w-0 w-fit",
                                    isMe ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm" : "bg-muted text-foreground rounded-2xl rounded-bl-sm",
                                    detectRtl(visibleText) && "text-right"
                                  )}
                                  dir="auto"
                                >
                                  {renderMentionText(visibleText)}
                                </div>
                              )}

                              {/* Audio attachments */}
                              {uniqueAttachments.filter((a) => isAudioUrl(a.url)).map((att, ai) => (
                                <div key={`aud-${ai}`} className="flex items-center gap-1.5 p-1.5 rounded-lg border border-border bg-muted/20 mt-1 max-w-full">
                                  <Mic className="w-3 h-3 text-primary shrink-0" />
                                  <audio controls preload="metadata" className="h-7 w-full min-w-0" src={att.url} />
                                </div>
                              ))}

                              {/* Inline images */}
                              {uniqueAttachments.filter((a) => isImageUrl(a.url) && !isAudioUrl(a.url)).map((att, ai) => (
                                <div key={ai} className="mt-1">
                                  <img src={att.url} alt={att.name} className="rounded-lg border border-border max-w-[200px] max-h-[160px] object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(att.url, "_blank")} />
                                  <button onClick={() => downloadFile(att.url, att.name)} className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors" title="Download">
                                    <Download className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}

                              {/* Non-image, non-audio file cards */}
                              {uniqueAttachments.filter((a) => !isImageUrl(a.url) && !isAudioUrl(a.url)).map((att, ai) => (
                                <div key={ai} className="mt-1 max-w-full">
                                  <InlineFileLink url={att.url} fileName={att.name} />
                                </div>
                              ))}

                              {/* Translation toggle */}
                              {!isMe && msg.original_language !== myLang && msg.translations[myLang] && (
                                <button onClick={() => toggleOriginal(msg.id)} className="inline-flex items-center gap-0.5 mt-0.5 px-1 text-[9px] text-muted-foreground hover:text-primary transition-colors">
                                  <Languages className="w-2.5 h-2.5" />
                                  {showOriginal.has(msg.id) ? "Show translation" : "Show original"}
                                </button>
                              )}

                              {/* Hover action bar */}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0 mt-0.5 flex-wrap">
                                <button onClick={() => handleTTS(displayText, msg.id)} className={cn("p-0.5 rounded transition-colors", playingMsgId === msg.id ? "text-primary" : "text-muted-foreground hover:text-foreground")} title={playingMsgId === msg.id ? "Stop" : "Listen"}>
                                  <Volume2 className="w-3 h-3" />
                                </button>
                                <button onClick={() => { setReplyTo(msg); textareaRef.current?.focus(); }} className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors" title="Reply">
                                  <Reply className="w-3 h-3" />
                                </button>
                                <button onClick={() => setForwardMsg(msg)} className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors" title="Forward">
                                  <Forward className="w-3 h-3" />
                                </button>
                                <button
                                  className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                                  onClick={async () => { try { await navigator.clipboard.writeText(originalClean || msg.original_text); toast.success("Copied!"); } catch { toast.error("Failed to copy"); } }}
                                  title="Copy"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                {canDelete && (
                                  <button onClick={() => handleDeleteMessage(msg.id)} className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </>
                          );
                        })()}

                        <span className="text-[9px] text-muted-foreground mt-0.5 px-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Forward popover */}
      {forwardMsg && (
        <div className="absolute inset-0 bg-background/90 z-10 rounded-t-xl flex flex-col p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">Forward to…</span>
            <button onClick={() => setForwardMsg(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="text-[10px] text-muted-foreground mb-2 truncate px-1 py-1 bg-muted/30 rounded">
            {forwardMsg.original_text.slice(0, 60)}
          </div>
          <ScrollArea className="flex-1">
            {forwardMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No team members found</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {forwardMembers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleForwardToMember(p.id)}
                    className="w-full flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
                  >
                    <Avatar className="w-5 h-5 flex-shrink-0">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className={`text-[8px] text-white ${getAvatarColor(p.full_name || "?")}`}>
                        {getInitials(p.full_name || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{p.full_name}</span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Pending files chips */}
      {pendingFiles.length > 0 && (
        <div className="px-2 pb-1 flex flex-wrap gap-1">
          {pendingFiles.map((pf, idx) => (
            <div key={idx} className="flex items-center gap-1 bg-muted rounded px-1.5 py-0.5 text-[10px] text-muted-foreground max-w-[150px]">
              <FileIcon className="w-3 h-3 shrink-0" />
              <span className="truncate">{pf.name}</span>
              <button onClick={() => removeFile(idx)} className="ml-0.5 hover:text-destructive"><X className="w-2.5 h-2.5" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Reply banner */}
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-1 border-t border-border bg-muted/30">
          <Reply className="w-3 h-3 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-semibold text-primary">{replyTo.sender?.full_name || profileMap.get(replyTo.sender_profile_id)?.full_name || "Unknown"}</span>
            <p className="text-[10px] text-muted-foreground truncate">{replyTo.original_text.slice(0, 60)}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground shrink-0"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-border p-2">
        {voiceRecorder.isRecording ? (
          <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-2 py-2 border border-border">
            <div className="flex items-center gap-1.5 text-destructive animate-pulse">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-[10px] font-medium">{formatVoiceDuration(voiceRecorder.duration)}</span>
            </div>
            <span className="text-[10px] text-muted-foreground flex-1">Recording...</span>
            <button onClick={voiceRecorder.cancelRecording} className="p-1 rounded text-muted-foreground hover:text-destructive" title="Cancel">
              <X className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleVoiceSend} disabled={uploading} className="p-1 rounded text-primary hover:bg-primary/10" title="Stop & Send">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          <div className="relative">
            {/* Mention menu */}
            <MentionMenu
              isOpen={mentionOpen}
              filter={mentionFilter}
              selectedIndex={mentionIndex}
              onSelect={handleMentionSelect}
              onClose={() => setMentionOpen(false)}
            />

            <div className="flex flex-col bg-muted/40 rounded-xl border border-border focus-within:ring-1 focus-within:ring-primary">
              <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent text-xs placeholder:text-muted-foreground focus:outline-none text-foreground min-w-0 px-3 py-2 resize-none max-h-20 overflow-y-auto"
                dir="auto"
                rows={1}
                placeholder={`Message ${channelName}…`}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (mentionOpen) {
                    if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => i + 1); return; }
                    if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => Math.max(0, i - 1)); return; }
                    if (e.key === "Escape") { e.preventDefault(); setMentionOpen(false); return; }
                  }
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                onPaste={(e) => { const files = e.clipboardData?.files; if (files?.length) { e.preventDefault(); addFiles(files); } }}
                disabled={isBusy}
              />

              {/* Bottom toolbar */}
              <div className="flex items-center justify-between px-1.5 pb-1.5">
                <div className="flex items-center gap-0.5">
                  <EmojiPicker onSelect={handleEmojiSelect} disabled={isBusy} />
                  <VoiceInputButton
                    isListening={speech.isListening}
                    isSupported={speech.isSupported}
                    onToggle={speech.isListening ? speech.stop : speech.start}
                    disabled={isBusy}
                    lang={voiceLang}
                    onLangChange={(l) => { if (speech.isListening) speech.stop(); setVoiceLang(l); }}
                    languages={LANG_LABELS}
                  />
                  <button
                    type="button"
                    onClick={() => voiceRecorder.startRecording()}
                    disabled={isBusy}
                    className={cn("p-1.5 rounded-md transition-colors bg-primary/10 text-primary hover:bg-primary/20", isBusy && "opacity-50 cursor-not-allowed")}
                    title="Record voice message"
                  >
                    <AudioLines className="w-3.5 h-3.5" />
                  </button>
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
                  <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50" onClick={() => fileInputRef.current?.click()} disabled={isBusy} title="Attach file">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  className={cn("p-1.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 rounded-md", (inputText.trim() || pendingFiles.length > 0) && "text-primary")}
                  onClick={handleSend}
                  disabled={(!inputText.trim() && pendingFiles.length === 0) || isBusy}
                  title="Send"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="h-3 mt-0.5">
          <p className="text-[9px] text-muted-foreground/60">
            {sendMutation.isPending && "Translating & sending..."}
            {voiceRecorder.isRecording && !sendMutation.isPending && "🔴 Recording..."}
            {speech.isListening && !sendMutation.isPending && !voiceRecorder.isRecording && "🎙️ Listening..."}
            {speech.interimText && !sendMutation.isPending && ` ${speech.interimText}`}
          </p>
        </div>
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-primary/10 rounded-t-xl flex items-center justify-center pointer-events-none">
          <p className="text-xs font-semibold text-primary">Drop files here</p>
        </div>
      )}
    </div>
  );
}
