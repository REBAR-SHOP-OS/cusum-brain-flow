import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Send, X, ImagePlus, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const RATIOS = ["16:9", "9:16", "1:1", "4:3"] as const;
const DURATIONS = [
  { label: "15s", value: "15" },
  { label: "30s", value: "30" },
  { label: "1min", value: "60" },
] as const;

interface ChatPromptBarProps {
  onSubmit: (
    prompt: string,
    ratio: string,
    images: File[],
    introImage: File | null,
    outroImage: File | null,
    duration: string,
    characterImage: File | null
  ) => void;
  disabled?: boolean;
}

export function ChatPromptBar({ onSubmit, disabled }: ChatPromptBarProps) {
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<string>("16:9");
  const [duration, setDuration] = useState<string>("15");
  const [introImage, setIntroImage] = useState<File | null>(null);
  const [outroImage, setOutroImage] = useState<File | null>(null);
  const [characterImage, setCharacterImage] = useState<File | null>(null);
  const introRef = useRef<HTMLInputElement>(null);
  const outroRef = useRef<HTMLInputElement>(null);
  const characterRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!prompt.trim() || disabled) return;
    onSubmit(prompt.trim(), ratio, [], introImage, outroImage, duration, characterImage);
    setPrompt("");
    setIntroImage(null);
    setOutroImage(null);
    setCharacterImage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleIntroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setIntroImage(e.target.files[0]);
    e.target.value = "";
  };

  const handleOutroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setOutroImage(e.target.files[0]);
    e.target.value = "";
  };

  const handleCharacterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setCharacterImage(e.target.files[0]);
    e.target.value = "";
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Intro / Outro upload boxes */}
      <div className="flex gap-4 justify-center">
        <input ref={introRef} type="file" accept="image/*" hidden onChange={handleIntroChange} />
        <button
          onClick={() => introRef.current?.click()}
          disabled={disabled}
          className={cn(
            "relative w-28 h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all",
            "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]",
            introImage ? "border-primary/40 bg-primary/5" : "border-border/40 bg-muted/10",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {introImage ? (
            <>
              <img src={URL.createObjectURL(introImage)} alt="Intro" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
              <div className="absolute inset-0 bg-background/40 rounded-xl" />
              <button
                onClick={(e) => { e.stopPropagation(); setIntroImage(null); }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center z-10 hover:bg-destructive/20"
              >
                <X className="w-3 h-3" />
              </button>
              <span className="relative z-10 text-[10px] font-medium text-foreground">Intro</span>
            </>
          ) : (
            <>
              <ImagePlus className="w-7 h-7 text-muted-foreground/60" />
              <span className="text-[10px] font-medium text-muted-foreground">Intro Image</span>
            </>
          )}
        </button>

        {/* Character upload */}
        <input ref={characterRef} type="file" accept="image/*" hidden onChange={handleCharacterChange} />
        <button
          onClick={() => characterRef.current?.click()}
          disabled={disabled}
          className={cn(
            "relative w-28 h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all",
            "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]",
            characterImage ? "border-primary/40 bg-primary/5" : "border-border/40 bg-muted/10",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {characterImage ? (
            <>
              <img src={URL.createObjectURL(characterImage)} alt="Character" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
              <div className="absolute inset-0 bg-background/40 rounded-xl" />
              <button
                onClick={(e) => { e.stopPropagation(); setCharacterImage(null); }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center z-10 hover:bg-destructive/20"
              >
                <X className="w-3 h-3" />
              </button>
              <span className="relative z-10 text-[10px] font-medium text-foreground">Character</span>
            </>
          ) : (
            <>
              <UserRound className="w-7 h-7 text-muted-foreground/60" />
              <span className="text-[10px] font-medium text-muted-foreground">Character 👤</span>
            </>
          )}
        </button>

        <input ref={outroRef} type="file" accept="image/*" hidden onChange={handleOutroChange} />
        <button
          onClick={() => outroRef.current?.click()}
          disabled={disabled}
          className={cn(
            "relative w-28 h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all",
            "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]",
            outroImage ? "border-primary/40 bg-primary/5" : "border-border/40 bg-muted/10",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {outroImage ? (
            <>
              <img src={URL.createObjectURL(outroImage)} alt="Outro" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
              <div className="absolute inset-0 bg-background/40 rounded-xl" />
              <button
                onClick={(e) => { e.stopPropagation(); setOutroImage(null); }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center z-10 hover:bg-destructive/20"
              >
                <X className="w-3 h-3" />
              </button>
              <span className="relative z-10 text-[10px] font-medium text-foreground">Outro</span>
            </>
          ) : (
            <>
              <ImagePlus className="w-7 h-7 text-muted-foreground/60" />
              <span className="text-[10px] font-medium text-muted-foreground">Outro Image</span>
            </>
          )}
        </button>
      </div>

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

        {/* Bottom bar — grouped controls */}
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-3">
            {/* Ratio group */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">Ratio</span>
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

            {/* Divider */}
            <div className="w-px h-5 bg-border/30" />

            {/* Duration group */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">Duration</span>
              <div className="flex gap-0.5 rounded-lg border border-border/20 p-0.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDuration(d.value)}
                    disabled={disabled}
                    className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-medium transition-all",
                      duration === d.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
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
