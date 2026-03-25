import { useState } from "react";
import { Copy, RefreshCw, ThumbsUp, ThumbsDown, Brain, CheckSquare, Languages, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AddToTaskButton } from "@/components/shared/AddToTaskButton";
import { CreateTaskDialog, type CreateTaskDefaults } from "@/components/shared/CreateTaskDialog";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const TRANSLATE_LANGS = [
  { code: "fa", label: "فارسی (Persian)" },
  { code: "ar", label: "العربية (Arabic)" },
  { code: "tr", label: "Türkçe (Turkish)" },
  { code: "es", label: "Español (Spanish)" },
  { code: "fr", label: "Français (French)" },
  { code: "de", label: "Deutsch (German)" },
  { code: "zh", label: "中文 (Chinese)" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "ru", label: "Русский (Russian)" },
  { code: "en", label: "English" },
];

interface MessageActionsProps {
  content: string;
  messageId: string;
  onRegenerate?: () => void;
  onTranslate?: (translatedText: string, langLabel: string) => void;
}

export function MessageActions({ content, messageId, onRegenerate, onTranslate }: MessageActionsProps) {
  const { companyId } = useCompanyId();
  const { toast } = useToast();
  const [liked, setLiked] = useState<"up" | "down" | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleAddToBrain = async () => {
    if (!companyId) {
      toast({ title: "Still loading workspace, try again", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.from("knowledge").insert({
        title: content.slice(0, 80),
        content,
        category: "agent-response",
        company_id: companyId,
      });
      if (error) throw error;
      toast({ title: "Saved to Brain" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleTranslate = async (langCode: string, langLabel: string) => {
    setLangOpen(false);
    setTranslating(true);
    try {
      const result = await invokeEdgeFunction<{ translations: Record<string, string> }>(
        "translate-message",
        {
          text: content,
          sourceLang: "auto",
          targetLangs: [langCode],
        }
      );
      const translated = result.translations?.[langCode];
      if (translated) {
        onTranslate?.(translated, langLabel);
      } else {
        toast({ title: "Translation returned empty", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: err.message || "Translation failed", variant: "destructive" });
    } finally {
      setTranslating(false);
    }
  };

  const taskDefaults: CreateTaskDefaults = {
    title: content.slice(0, 80),
    description: content.slice(0, 300),
    source: "agent-chat",
    sourceRef: messageId,
  };

  const actions = [
    {
      icon: Copy,
      label: "Copy",
      onClick: handleCopy,
      active: false,
    },
    {
      icon: RefreshCw,
      label: "Regenerate",
      onClick: onRegenerate,
      active: false,
    },
    {
      icon: ThumbsUp,
      label: "Like",
      onClick: () => setLiked(liked === "up" ? null : "up"),
      active: liked === "up",
    },
    {
      icon: ThumbsDown,
      label: "Dislike",
      onClick: () => setLiked(liked === "down" ? null : "down"),
      active: liked === "down",
    },
    {
      icon: Brain,
      label: "Add to Brain",
      onClick: handleAddToBrain,
      active: false,
    },
    {
      icon: CheckSquare,
      label: "Add to Task",
      onClick: () => setTaskOpen(true),
      active: false,
    },
  ];

  return (
    <>
      <div className="flex items-center gap-0.5 mt-1">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            title={action.label}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              action.active
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <action.icon className="w-3.5 h-3.5" />
          </button>
        ))}

        {/* Translate button with language picker */}
        <Popover open={langOpen} onOpenChange={setLangOpen}>
          <PopoverTrigger asChild>
            <button
              title="Translate"
              className={cn(
                "p-1.5 rounded-md transition-colors",
                translating
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              disabled={translating}
            >
              {translating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Languages className="w-3.5 h-3.5" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start" sideOffset={4}>
            <div className="flex flex-col">
              {TRANSLATE_LANGS.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleTranslate(lang.code, lang.label)}
                  className="text-left text-sm px-3 py-1.5 rounded hover:bg-muted transition-colors"
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <CreateTaskDialog open={taskOpen} onOpenChange={setTaskOpen} defaults={taskDefaults} />
    </>
  );
}
