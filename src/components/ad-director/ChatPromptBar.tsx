import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Send, ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

const RATIOS = ["16:9", "9:16", "1:1", "4:3"] as const;

interface ChatPromptBarProps {
  onSubmit: (prompt: string, ratio: string, images: File[]) => void;
  disabled?: boolean;
}

export function ChatPromptBar({ onSubmit, disabled }: ChatPromptBarProps) {
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<string>("16:9");
  const [images, setImages] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!prompt.trim() || disabled) return;
    onSubmit(prompt.trim(), ratio, images);
    setPrompt("");
    setImages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImages(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = "";
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3">
      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap px-1">
          {images.map((img, i) => (
            <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border/30 bg-muted/20">
              <img src={URL.createObjectURL(img)} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removeImage(i)}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main input area */}
      <div className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm shadow-lg overflow-hidden transition-shadow focus-within:shadow-xl focus-within:border-border/50">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your video idea..."
          disabled={disabled}
          rows={2}
          className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
        />

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-2">
            {/* Upload */}
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFileChange} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={disabled}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-40"
              title="Upload images"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Ratio pills */}
            <div className="flex gap-0.5 rounded-lg border border-border/20 p-0.5">
              {RATIOS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRatio(r)}
                  disabled={disabled}
                  className={cn(
                    "px-2 py-1 rounded-md text-[10px] font-medium transition-all",
                    ratio === r
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Send */}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!prompt.trim() || disabled}
            className="h-8 w-8 rounded-xl p-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
