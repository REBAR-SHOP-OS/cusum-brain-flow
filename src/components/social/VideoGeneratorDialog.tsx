import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Video, ExternalLink } from "lucide-react";
import { VideoStudioContent } from "./VideoStudioContent";
import { useNavigate } from "react-router-dom";

interface VideoGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVideoReady?: (videoUrl: string) => void;
}

export function VideoGeneratorDialog({ open, onOpenChange, onVideoReady }: VideoGeneratorDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Video className="w-4 h-4 text-white" />
              </div>
              AI Video Studio
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => {
                onOpenChange(false);
                navigate("/video-studio");
              }}
            >
              <ExternalLink className="w-3 h-3" />
              Full Studio
            </Button>
          </div>
        </DialogHeader>

        <VideoStudioContent
          onVideoReady={(url) => {
            onVideoReady?.(url);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
