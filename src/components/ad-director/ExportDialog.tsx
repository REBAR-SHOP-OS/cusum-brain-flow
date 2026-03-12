import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Download, Share2, Loader2, Cloud, Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { VideoToSocialPanel } from "@/components/social/VideoToSocialPanel";

const QUALITIES = [
  { value: "1080p", label: "1080p", desc: "Full HD (1920×1080)", badge: "Recommended" },
  { value: "720p", label: "720p", desc: "HD (1280×720)", badge: null },
  { value: "480p", label: "480p", desc: "SD (854×480)", badge: null },
];

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finalVideoUrl: string | null;
  brandName?: string;
  onExport: () => void;
  exporting?: boolean;
  aspectRatio?: string;
}

export function ExportDialog({
  open, onOpenChange, finalVideoUrl, brandName = "Ad",
  onExport, exporting, aspectRatio = "16:9",
}: ExportDialogProps) {
  const { toast } = useToast();
  const [quality, setQuality] = useState("1080p");
  const [fileName, setFileName] = useState(`${brandName.replace(/\s+/g, "-").toLowerCase()}-ad`);
  const [storeInCloud, setStoreInCloud] = useState(true);
  const [description, setDescription] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [showSocial, setShowSocial] = useState(false);

  const handleExport = async () => {
    if (!finalVideoUrl) {
      onExport();
      return;
      return;
    }

    setDownloading(true);
    try {
      // Download
      const res = await fetch(finalVideoUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${fileName || "export"}.mp4`;
      a.click();
      URL.revokeObjectURL(a.href);

      // Cloud upload
      if (storeInCloud) {
        const path = `exports/${Date.now()}-${fileName}.mp4`;
        await supabase.storage.from("generated-videos").upload(path, blob, { contentType: "video/mp4" });
      }

      toast({ title: "Export complete", description: `${fileName}.mp4 downloaded successfully` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  if (showSocial && finalVideoUrl) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Share2 className="w-4 h-4 text-primary" /> Share to Social Media
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Prepare your video for social channels.
            </DialogDescription>
          <VideoToSocialPanel
            videoUrl={finalVideoUrl}
            aspectRatio={aspectRatio}
            onClose={() => { setShowSocial(false); onOpenChange(false); }}
          />
          <Button variant="ghost" size="sm" onClick={() => setShowSocial(false)} className="text-xs">
            ← Back to Export
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        <div className="flex min-h-[380px]">
          {/* Left — Quality */}
          <div className="w-52 shrink-0 border-r border-border/50 bg-muted/30 p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Quality</h3>
              <p className="text-[10px] text-muted-foreground">Select export resolution</p>
            </div>
            <RadioGroup value={quality} onValueChange={setQuality} className="space-y-2">
              {QUALITIES.map(q => (
                <label
                  key={q.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    quality === q.value
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-muted-foreground/30"
                  }`}
                >
                  <RadioGroupItem value={q.value} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{q.label}</span>
                      {q.badge && (
                        <Badge variant="secondary" className="text-[8px] px-1 py-0">{q.badge}</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{q.desc}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Right — Details */}
          <div className="flex-1 p-5 space-y-5">
            <DialogHeader className="p-0">
              <DialogTitle className="flex items-center gap-2">
                <Film className="w-5 h-5 text-primary" />
                Export Video
              </DialogTitle>
            </DialogHeader>

            {/* File name */}
            <div className="space-y-1.5">
              <Label className="text-xs">File name</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={fileName}
                  onChange={e => setFileName(e.target.value)}
                  className="flex-1 text-sm"
                  placeholder="my-video"
                />
                <span className="text-xs text-muted-foreground shrink-0">.mp4</span>
              </div>
            </div>

            {/* Store in cloud */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium">Store in cloud</p>
                  <p className="text-[10px] text-muted-foreground">Save a copy to your cloud storage</p>
                </div>
              </div>
              <Switch checked={storeInCloud} onCheckedChange={setStoreInCloud} />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add notes about this export..."
                className="min-h-[60px] text-sm resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400"
                onClick={handleExport}
                disabled={downloading || exporting}
              >
                {downloading || exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {downloading ? "Downloading..." : exporting ? "Stitching..." : "Export"}
              </Button>
              {finalVideoUrl && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setShowSocial(true)}
                >
                  <Share2 className="w-4 h-4" />
                  Share to Social
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
