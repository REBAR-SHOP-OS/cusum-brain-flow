import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageCircle, Image, Plus, Minus, ChevronLeft, Upload } from "lucide-react";

interface CreateContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "choose" | "create";

export function CreateContentDialog({ open, onOpenChange }: CreateContentDialogProps) {
  const [step, setStep] = useState<Step>("choose");
  const [postCount, setPostCount] = useState(1);

  const handleClose = () => {
    onOpenChange(false);
    setStep("choose");
  };

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
                <p className="font-medium">Create with Soshie</p>
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
                  Add your own media — Soshie will turn it into ready-to-post content.
                </p>
              </div>
              <ChevronLeft className="w-5 h-5 rotate-180 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Upload Zone */}
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Plus className="w-5 h-5" />
              </div>
              <p className="font-medium">Click to upload or drag and drop</p>
              <p className="text-sm text-muted-foreground">PNG, JPG or MP4 up to 10MB. Max 10 files.</p>
            </div>

            {/* Add from Media Library */}
            <Button variant="outline" className="w-full">
              <Upload className="w-4 h-4 mr-2" />
              Add from media library
            </Button>

            {/* Instructions */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Instructions</Label>
              <Textarea
                placeholder="Add your instructions — e.g. 'Create posts and stories for next week with productivity tips and a call-to-action to book a session'."
                className="min-h-[100px] resize-none"
              />
            </div>

            {/* What can Soshie make */}
            <p className="text-sm text-center text-muted-foreground underline cursor-pointer">
              What content can Soshie make?
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
            <Button className="w-full" disabled>
              Generate post
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
