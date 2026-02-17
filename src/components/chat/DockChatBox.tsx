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

  const ChannelIcon = channelType === "group" ? Hash : Users;
  const isBusy = uploading || sendMutation.isPending;

  // Minimized state
  if (minimized) {
    return (
      <div
        style={style}
        className="fixed bottom-0 z-[9998] w-[320px] cursor-pointer"
        onClick={() => toggleMinimize(channelId)}
      >
        <div className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-t-lg shadow-lg">
          <ChannelIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs font-semibold truncate flex-1">{channelName}</span>
          <button
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/20"
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
      style={style}
      className={cn(
        "fixed bottom-0 z-[9998] w-[320px] flex flex-col bg-card border border-border rounded-t-lg shadow-2xl transition-colors",
        dragOver && "ring-2 ring-primary border-primary"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-t-lg">
        <ChannelIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="text-xs font-semibold truncate flex-1">{channelName}</span>
        <button
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/20"
          onClick={() => { closeChat(channelId); navigate("/team-hub"); }}
          title="Open full Team Hub"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
        <button
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/20"
          onClick={() => toggleMinimize(channelId)}
          title="Minimize"
        >
          <Minus className="w-3 h-3" />
        </button>
        <button
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/20"
          onClick={() => closeChat(channelId)}
          title="Close"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea className="h-[300px] px-3 py-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No messages yet</p>
        ) : (
          <div className="space-y-2.5">
            {messages.map((msg) => {
              const sender = profileMap.get(msg.sender_profile_id);
              const isMe = msg.sender_profile_id === myProfile?.id;
              const displayText =
                !isMe && msg.translations && msg.translations[myLang]
                  ? msg.translations[myLang]
                  : msg.original_text;
              return (
                <div key={msg.id} className="flex gap-1.5">
                  <Avatar className="w-5 h-5 mt-0.5 shrink-0">
                    <AvatarImage src={sender?.avatar_url || ""} />
                    <AvatarFallback className={cn("text-[8px] font-bold text-white", getAvatarColor(sender?.full_name || "?"))}>
                      {getInitials(sender?.full_name || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[11px] font-semibold text-foreground">{sender?.full_name || "Unknown"}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/90 break-words">{displayText}</p>
                  </div>
                </div>
              );
            })}
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

      {/* Input */}
      <div className="border-t border-border p-2">
        <div className="flex gap-1">
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            title="Attach file"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </Button>
          <input
            className="flex-1 h-8 rounded border border-border bg-background px-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Type a message…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={isBusy}
          />
          <Button size="sm" className="h-8 w-8 p-0" onClick={handleSend} disabled={(!inputText.trim() && pendingFiles.length === 0) || isBusy}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-primary/10 rounded-t-lg flex items-center justify-center pointer-events-none">
          <p className="text-xs font-semibold text-primary">Drop files here</p>
        </div>
      )}
    </div>
  );
}
