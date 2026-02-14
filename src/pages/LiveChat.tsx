import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Loader2, Square, Trash2, Type, Hash, Headset, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminChat } from "@/hooks/useAdminChat";
import { RichMarkdown } from "@/components/chat/RichMarkdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import { getUserPrimaryAgent, getUserPrimaryAgentKey } from "@/lib/userAgentMap";
import assistantHelper from "@/assets/helpers/assistant-helper.png";
import { FormattingToolbar } from "@/components/chat/FormattingToolbar";
import { EmojiPicker } from "@/components/chat/EmojiPicker";
import { VoiceInputButton } from "@/components/chat/VoiceInputButton";
import { QuickTemplates } from "@/components/chat/QuickTemplates";
import { SlashCommandMenu, SlashCommand } from "@/components/chat/SlashCommandMenu";
import { MentionMenu } from "@/components/chat/MentionMenu";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useToast } from "@/hooks/use-toast";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

export default function LiveChat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const agent = getUserPrimaryAgent(user?.email);
  const agentKey = getUserPrimaryAgentKey(user?.email);
  const avatarImg = agent?.image || assistantHelper;
  const agentName = agent?.name || "Vizzy";
  const showVoiceChat = agentKey === "assistant" || agentKey === "accounting";
  const { toast } = useToast();

  const [input, setInput] = useState("");
  const { messages, isStreaming, sendMessage, clearChat, cancelStream } = useAdminChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);

  // Fetch memory count
  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from("vizzy_memory")
        .select("*", { count: "exact", head: true });
      if (typeof count === "number") setMemoryCount(count);
    })();
  }, []);

  // Toolbar state
  const [showFormatting, setShowFormatting] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

  const speech = useSpeechRecognition({
    onError: (error) => toast({ title: "Voice Input", description: error, variant: "destructive" }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Append speech transcripts
  useEffect(() => {
    if (speech.fullTranscript) {
      setInput((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${speech.fullTranscript}` : speech.fullTranscript;
      });
    }
  }, [speech.fullTranscript]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleValueChange = useCallback((newValue: string) => {
    setInput(newValue);
    if (newValue === "/" || (newValue.startsWith("/") && !newValue.includes(" "))) {
      setSlashOpen(true);
      setSlashFilter(newValue.slice(1));
      setSlashIndex(0);
    } else {
      setSlashOpen(false);
    }
    const atMatch = newValue.match(/@(\w*)$/);
    if (atMatch) {
      setMentionOpen(true);
      setMentionFilter(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
    }
  }, []);

  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    setInput(cmd.value);
    setSlashOpen(false);
    inputRef.current?.focus();
  }, []);

  const handleMentionSelect = useCallback((item: { label: string }) => {
    setInput((prev) => prev.replace(/@\w*$/, `@${item.label} `));
    setMentionOpen(false);
    inputRef.current?.focus();
  }, []);

  const handleEmojiSelect = useCallback((emoji: string) => {
    const textarea = inputRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newVal = input.slice(0, start) + emoji + input.slice(end);
      setInput(newVal);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      });
    } else {
      setInput((prev) => prev + emoji);
    }
  }, [input]);

  const handleFormat = useCallback((prefix: string, suffix: string) => {
    const textarea = inputRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = input.slice(start, end) || "text";
    const newVal = input.slice(0, start) + prefix + selected + suffix + input.slice(end);
    setInput(newVal);
    requestAnimationFrame(() => {
      textarea.selectionStart = start + prefix.length;
      textarea.selectionEnd = start + prefix.length + selected.length;
      textarea.focus();
    });
  }, [input]);

  const handleTemplateSelect = useCallback((text: string) => {
    setInput(text);
    inputRef.current?.focus();
  }, []);

  const handleVoiceToggle = useCallback(() => {
    if (speech.isListening) {
      speech.stop();
    } else {
      speech.start();
    }
  }, [speech]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    if (speech.isListening) speech.stop();
    sendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slashOpen) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIndex((i) => i + 1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSlashIndex((i) => Math.max(0, i - 1)); return; }
      if (e.key === "Escape") { e.preventDefault(); setSlashOpen(false); return; }
    }
    if (mentionOpen) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => i + 1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => Math.max(0, i - 1)); return; }
      if (e.key === "Escape") { e.preventDefault(); setMentionOpen(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-teal-400 shrink-0">
            <img src={avatarImg} alt={agentName} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">{agentName}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              JARVIS Mode
              {memoryCount !== null && memoryCount > 0 && (
                <span className="inline-flex items-center gap-0.5 ml-1 text-primary">
                  <Brain className="w-3 h-3" />
                  {memoryCount}
                </span>
              )}
            </p>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={clearChat} title="Clear chat">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-teal-400 mx-auto mb-4">
                  <img src={avatarImg} alt={agentName} className="w-full h-full object-cover" />
                </div>
                <p className="text-lg font-medium">How can I help you?</p>
                <p className="text-sm text-muted-foreground mt-1">Ask anything about your business</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm max-w-[85%]",
                  msg.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-muted text-foreground"
                )}
              >
                {msg.role === "assistant" ? (
                  <RichMarkdown content={msg.content} className="text-sm [&_p]:text-sm" />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            ))}

            {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="mr-auto bg-muted rounded-2xl px-4 py-3 text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-muted-foreground">Thinking...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Voice recording indicator */}
        {speech.isListening && (
          <div className="px-4 py-2 flex items-center gap-2 text-sm text-destructive animate-pulse">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            Listening... {speech.interimText && <span className="text-muted-foreground italic truncate">"{speech.interimText}"</span>}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border bg-card p-4 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="relative bg-secondary rounded-xl border border-border/50 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-primary/30">
              {/* Formatting toolbar */}
              <FormattingToolbar onFormat={handleFormat} disabled={isStreaming} visible={showFormatting} />

              {/* Slash command menu */}
              <SlashCommandMenu
                isOpen={slashOpen}
                filter={slashFilter}
                selectedIndex={slashIndex}
                onSelect={handleSlashSelect}
                onClose={() => setSlashOpen(false)}
              />

              {/* Mention menu */}
              <MentionMenu
                isOpen={mentionOpen}
                filter={mentionFilter}
                selectedIndex={mentionIndex}
                onSelect={handleMentionSelect}
                onClose={() => setMentionOpen(false)}
              />

              {/* Textarea */}
              <div className="px-3 pt-3 pb-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => handleValueChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="w-full bg-transparent resize-none text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
                  rows={1}
                  disabled={isStreaming}
                />
              </div>

              {/* Bottom toolbar */}
              <div className="flex items-center gap-0.5 px-2 pb-2">
                <EmojiPicker onSelect={handleEmojiSelect} disabled={isStreaming} />
                <VoiceInputButton isListening={speech.isListening} isSupported={speech.isSupported} onToggle={handleVoiceToggle} disabled={isStreaming} />
                <QuickTemplates onSelect={handleTemplateSelect} disabled={isStreaming} />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowFormatting(!showFormatting)}
                      className={cn(
                        "p-2 rounded-md transition-colors",
                        showFormatting ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Type className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Formatting</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = inputRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const newVal = input.slice(0, start) + "/" + input.slice(start);
                          handleValueChange(newVal);
                          textarea.focus();
                        }
                      }}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                    >
                      <Hash className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                <TooltipContent side="top">Commands (/)</TooltipContent>
                </Tooltip>

                {showVoiceChat && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => navigate("/vizzy")}
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                      >
                        <Headset className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Voice Chat</TooltipContent>
                  </Tooltip>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Send / Stop */}
                {isStreaming ? (
                  <Button size="icon" variant="destructive" className="h-9 w-9 rounded-lg shrink-0" onClick={cancelStream}>
                    <Square className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button size="icon" className="h-9 w-9 rounded-lg shrink-0" onClick={handleSend} disabled={!input.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Hint footer */}
            <div className="flex justify-end mt-2 px-1">
              <p className="text-xs text-muted-foreground">
                Type <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">/</kbd> for commands · <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">@</kbd> to mention
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
