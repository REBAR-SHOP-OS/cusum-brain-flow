import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, X, Maximize2, Send, Hash, Users, Paperclip, FileIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTeamMessages, useSendMessage, useMyProfile } from "@/hooks/useTeamChat";
import { useProfiles } from "@/hooks/useProfiles";
import { useDockChat } from "@/contexts/DockChatContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

  // --- Drag state ---
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, offsetX: 0, offsetY: 0 });

  // Reset drag offset when minimized
  useEffect(() => {
    if (minimized) setDragOffset({ x: 0, y: 0 });
  }, [minimized]);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      offsetX: dragOffset.x,
      offsetY: dragOffset.y,
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = ev.clientX - dragStart.current.mouseX;
      const dy = ev.clientY - dragStart.current.mouseY;
      setDragOffset({
        x: dragStart.current.offsetX + dx,
        y: dragStart.current.offsetY + dy,
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

  const stopDragPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const myLang = myProfile?.preferred_language || "en";
  const targetLangs = useMemo(() => {
    const langs = new Set<string>();
    for (const p of profiles) {
      if (p.is_active && p.preferred_language) langs.add(p.preferred_language);
    }
    return [...langs];
  }, [profiles]);

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  useEffect(() => {
    if (!minimized) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, minimized]);

  // Group messages by date
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

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid: PendingFile[] = [];
    for (const f of arr) {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`File "${f.name}" exceeds 10MB limit`);
        continue;
      }
      valid.push({ file: f, name: f.name, size: f.size });
    }
    if (valid.length) setPendingFiles((prev) => [...prev, ...valid]);
  }, []);

  const removeFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  }, [addFiles]);

  const uploadFiles = async (): Promise<Array<{ name: string; url: string; type: string; size: number }>> => {
    const results: Array<{ name: string; url: string; type: string; size: number }> = [];
    for (const pf of pendingFiles) {
      const path = `chat-uploads/${channelId}/${Date.now()}-${pf.name}`;
      const { error } = await supabase.storage.from("team-chat-files").upload(path, pf.file);
      if (error) throw new Error(`Upload failed: ${pf.name}`);
      const { data: signed } = await supabase.storage.from("team-chat-files").createSignedUrl(path, 7 * 24 * 3600);
      results.push({
        name: pf.name,
        url: signed?.signedUrl || "",
        type: pf.file.type,
        size: pf.size,
      });
    }
    return results;
  };

  const handleSend = async () => {
    if ((!inputText.trim() && pendingFiles.length === 0) || !myProfile) return;
    const text = inputText.trim();
    setInputText("");

    try {
      let attachments: Array<{ name: string; url: string; type: string; size: number }> | undefined;
      if (pendingFiles.length > 0) {
        setUploading(true);
        attachments = await uploadFiles();
        setPendingFiles([]);
        setUploading(false);
      }

      const msgText = attachments?.length
        ? [text, ...attachments.map((a) => `📎 [${a.name}](${a.url})`)].filter(Boolean).join("\n")
        : text;

      if (!msgText) return;

      await sendMutation.mutateAsync({
        channelId,
        senderProfileId: myProfile.id,
        text: msgText,
        senderLang: myLang,
        targetLangs,
      });
    } catch (err: any) {
      setUploading(false);
      toast.error("Failed to send", { description: err.message });
    }
  };

  const isBusy = uploading || sendMutation.isPending;

  // Get avatar info for header — for DMs, derive partner from message senders, not all profiles
  const headerProfile = useMemo(() => {
    if (channelType === "dm") {
      // Find the other person's profile_id from message history
      const otherSenderId = messages.find(
        (m) => m.sender_profile_id !== myProfile?.id
      )?.sender_profile_id;
      if (otherSenderId) return profileMap.get(otherSenderId) || null;
      // Fallback: use channel name to match a profile (last resort)
      return profiles.find((p) => p.id !== myProfile?.id && channelName.includes(p.full_name)) || null;
    }
    return null;
  }, [channelType, messages, myProfile, profileMap, profiles, channelName]);

  const headerName = channelName;
  const headerInitials = getInitials(headerName);
  const headerColor = getAvatarColor(headerName);

  // Merge style prop with drag offset
  const containerStyle: React.CSSProperties = {
    ...style,
    transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
  };

  // --- Minimized state (Odoo-style white pill) ---
  if (minimized) {
    return (
      <div
        style={style}
        className="fixed bottom-0 z-[9998] w-[280px] cursor-pointer"
        onClick={() => toggleMinimize(channelId)}
      >
        <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-t-xl shadow-lg">
          <div className="relative shrink-0">
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold", headerColor)}>
              {headerInitials}
            </div>
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border-2 border-background rounded-full" />
          </div>
          <span className="text-xs font-semibold text-foreground truncate flex-1">{channelName}</span>
          <button
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
            onClick={(e) => { e.stopPropagation(); closeChat(channelId); }}
          >
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
        "fixed bottom-0 z-[9998] w-[320px] flex flex-col bg-background border border-border rounded-t-xl shadow-2xl transition-colors",
        dragOver && "ring-2 ring-primary border-primary"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header — Odoo style, draggable */}
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 py-2.5 bg-background border-b border-border rounded-t-xl",
          isDragging.current ? "cursor-grabbing" : "cursor-grab"
        )}
        onMouseDown={handleHeaderMouseDown}
      >
        {/* Avatar with online dot */}
        <div className="relative shrink-0">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold", headerColor)}>
            {headerProfile?.avatar_url ? (
              <img src={headerProfile.avatar_url} alt={headerName} className="w-full h-full rounded-full object-cover" />
            ) : (
              headerInitials
            )}
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
        </div>

        {/* Name + subtitle */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-foreground truncate leading-tight">{channelName}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {channelType === "group" ? "Group Channel" : "Online"}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0" onMouseDown={stopDragPropagation}>
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
            onClick={() => { closeChat(channelId); navigate("/team-hub"); }}
            title="Open full Team Hub"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
            onClick={() => toggleMinimize(channelId)}
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
            onClick={() => closeChat(channelId)}
            title="Close"
          >
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
                {/* Date separator */}
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-muted-foreground font-medium px-1 shrink-0">{group.dateLabel}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {group.msgs.map((msg, idx) => {
                  const sender = profileMap.get(msg.sender_profile_id);
                  const isMe = msg.sender_profile_id === myProfile?.id;
                  const displayText =
                    !isMe && msg.translations && msg.translations[myLang]
                      ? msg.translations[myLang]
                      : msg.original_text;

                  // Show avatar/name only for first message in a sequence from same sender
                  const prevMsg = group.msgs[idx - 1];
                  const isFirstInSequence = !prevMsg || prevMsg.sender_profile_id !== msg.sender_profile_id;

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex gap-1.5 w-full",
                        isMe ? "flex-row-reverse" : "flex-row",
                        isFirstInSequence ? "mt-2" : "mt-0.5"
                      )}
                    >
                      {/* Avatar — only for others, only first in sequence */}
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

                      <div className={cn("flex flex-col max-w-[75%]", isMe ? "items-end" : "items-start")}>
                        {/* Sender name for group channels */}
                        {!isMe && isFirstInSequence && channelType === "group" && (
                          <span className="text-[10px] font-semibold text-muted-foreground mb-0.5 px-1">
                            {sender?.full_name || "Unknown"}
                          </span>
                        )}

                        {/* Bubble */}
                        <div
                          className={cn(
                            "px-3 py-1.5 text-xs leading-relaxed break-words",
                            isMe
                              ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                              : "bg-muted text-foreground rounded-2xl rounded-bl-sm"
                          )}
                        >
                          {displayText}
                        </div>

                        {/* Timestamp */}
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

      {/* Pending files chips */}
      {pendingFiles.length > 0 && (
        <div className="px-2 pb-1 flex flex-wrap gap-1">
          {pendingFiles.map((pf, idx) => (
            <div key={idx} className="flex items-center gap-1 bg-muted rounded px-1.5 py-0.5 text-[10px] text-muted-foreground max-w-[150px]">
              <FileIcon className="w-3 h-3 shrink-0" />
              <span className="truncate">{pf.name}</span>
              <button onClick={() => removeFile(idx)} className="ml-0.5 hover:text-destructive">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer — Odoo style */}
      <div className="border-t border-border p-2">
        <div className="flex items-center gap-1.5 bg-muted/40 rounded-xl px-2 py-1.5 border border-border focus-within:ring-1 focus-within:ring-primary">
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            title="Attach file"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>
          <input
            className="flex-1 bg-transparent text-xs placeholder:text-muted-foreground focus:outline-none text-foreground min-w-0"
            placeholder={`Message ${channelName}…`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            onPaste={(e) => { const files = e.clipboardData?.files; if (files?.length) { e.preventDefault(); addFiles(files); } }}
            disabled={isBusy}
          />
          <button
            className={cn(
              "text-muted-foreground hover:text-primary transition-colors disabled:opacity-40",
              (inputText.trim() || pendingFiles.length > 0) && "text-primary"
            )}
            onClick={handleSend}
            disabled={(!inputText.trim() && pendingFiles.length === 0) || isBusy}
            title="Send"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
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
