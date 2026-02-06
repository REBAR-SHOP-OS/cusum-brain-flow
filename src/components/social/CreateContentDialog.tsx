import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageCircle, Image, Plus, Minus, ChevronLeft, Upload, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreateContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "choose" | "create";

interface UploadedMedia {
  name: string;
  url: string;
  type: string;
}

export function CreateContentDialog({ open, onOpenChange }: CreateContentDialogProps) {
  const [step, setStep] = useState<Step>("choose");
  const [postCount, setPostCount] = useState(1);
  const [instructions, setInstructions] = useState("");
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleClose = () => {
    onOpenChange(false);
    setStep("choose");
    setInstructions("");
    setUploadedMedia([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (uploadedMedia.length + files.length > 10) {
      toast({ title: "Too many files", description: "Maximum 10 files allowed.", variant: "destructive" });
      return;
    }

    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds 10MB limit.`, variant: "destructive" });
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        if (url) {
          setUploadedMedia((prev) => [...prev, { name: file.name, url, type: file.type }]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleRemoveMedia = (index: number) => {
    setUploadedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    // Simulate generation (replace with actual AI call later)
    await new Promise((r) => setTimeout(r, 2000));
    setGenerating(false);
    toast({ title: "Posts generated!", description: `${postCount} post${postCount > 1 ? "s" : ""} created by Sushie.` });
    handleClose();
  };

  const canGenerate = instructions.trim().length > 0 || uploadedMedia.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step === "create" && (
              <Button variant="ghost" size="icon" onClick={() => setStep("choose")}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            <DialogTitle>Create content</DialogTitle>
          </div>
        </DialogHeader>

        {step === "choose" ? (
          <div className="space-y-3">
            <button
              onClick={() => setStep("create")}
              className="w-full flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Create with Sushie</p>
                <p className="text-sm text-muted-foreground">
                  Talk to your Social Media Manager and create posts together.
                </p>
              </div>
              <ChevronLeft className="w-5 h-5 rotate-180 text-muted-foreground" />
            </button>

            <button
              onClick={() => setStep("create")}
              className="w-full flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white">
                <Image className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Create from media</p>
                <p className="text-sm text-muted-foreground">
                  Add your own media — Sushie will turn it into ready-to-post content.
                </p>
              </div>
              <ChevronLeft className="w-5 h-5 rotate-180 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Plus className="w-5 h-5" />
              </div>
              <p className="font-medium">Click to upload or drag and drop</p>
              <p className="text-sm text-muted-foreground">PNG, JPG or MP4 up to 10MB. Max 10 files.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/mp4"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Uploaded Media Preview */}
            {uploadedMedia.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {uploadedMedia.map((media, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden group">
                    <img src={media.url} alt={media.name} className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemoveMedia(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add from Media Library */}
            <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Add from media library
            </Button>

            {/* Instructions */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Instructions</Label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Add your instructions — e.g. 'Create posts and stories for next week with productivity tips and a call-to-action to book a session'."
                className="min-h-[100px] resize-none"
              />
            </div>

            {/* What can Sushie make */}
            <p className="text-sm text-center text-muted-foreground underline cursor-pointer">
              What content can Sushie make?
            </p>

            {/* Post Count */}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Post count</span>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => setPostCount(Math.max(1, postCount - 1))}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="w-8 text-center font-medium">{postCount}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => setPostCount(Math.min(10, postCount + 1))}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Generate Button */}
            <Button
              className="w-full gap-2"
              disabled={!canGenerate || generating}
              onClick={handleGenerate}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                `Generate ${postCount} post${postCount > 1 ? "s" : ""}`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
