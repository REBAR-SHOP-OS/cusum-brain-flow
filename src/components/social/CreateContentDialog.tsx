import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Image, Plus, Minus, ChevronLeft, Upload, X, Loader2, Calendar, Video } from "lucide-react";
import { VideoGeneratorDialog } from "./VideoGeneratorDialog";
import { useToast } from "@/hooks/use-toast";
import { useSocialPosts } from "@/hooks/useSocialPosts";
import { supabase } from "@/integrations/supabase/client";

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

const platforms = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "X / Twitter" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
];

export function CreateContentDialog({ open, onOpenChange }: CreateContentDialogProps) {
  const [step, setStep] = useState<Step>("choose");
  const [showVideoGen, setShowVideoGen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState("facebook");
  const [status, setStatus] = useState("draft");
  const [scheduledDate, setScheduledDate] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { createPost } = useSocialPosts();

  const handleClose = () => {
    onOpenChange(false);
    setStep("choose");
    setShowVideoGen(false);
    setTitle("");
    setContent("");
    setPlatform("facebook");
    setStatus("draft");
    setScheduledDate("");
    setHashtags("");
    setUploadedMedia([]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (uploadedMedia.length + files.length > 10) {
      toast({ title: "Too many files", description: "Maximum 10 files allowed.", variant: "destructive" });
      return;
    }

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds 10MB limit.`, variant: "destructive" });
        continue;
      }

      // Upload to storage
      const ext = file.name.split(".").pop();
      const filePath = `social-media/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("estimation-files").upload(filePath, file);
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
        continue;
      }

      const { getSignedFileUrl } = await import("@/lib/storageUtils");
      const signedUrl = await getSignedFileUrl(filePath);
      setUploadedMedia((prev) => [...prev, { name: file.name, url: signedUrl, type: file.type }]);
    }
    e.target.value = "";
  };

  const handleRemoveMedia = (index: number) => {
    setUploadedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Not authenticated", description: "Please log in first.", variant: "destructive" });
        setSaving(false);
        return;
      }

      const hashtagArray = hashtags
        .split(/[,\s]+/)
        .map((h) => h.trim())
        .filter((h) => h.length > 0)
        .map((h) => (h.startsWith("#") ? h : `#${h}`));

      await createPost.mutateAsync({
        title: title || "Untitled Post",
        content,
        platform: platform as any,
        status: status as any,
        scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : null,
        hashtags: hashtagArray,
        image_url: uploadedMedia[0]?.url || null,
        user_id: user.id,
      });

      handleClose();
    } catch {
      // Error handled in mutation
    } finally {
      setSaving(false);
    }
  };

  const canSave = title.trim().length > 0 || content.trim().length > 0;

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <p className="font-medium">Create with Pixel</p>
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
                  Add your own media — Pixel will turn it into ready-to-post content.
                </p>
              </div>
              <ChevronLeft className="w-5 h-5 rotate-180 text-muted-foreground" />
            </button>

            <button
              onClick={() => setShowVideoGen(true)}
              className="w-full flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
                <Video className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Generate AI Video</p>
                <p className="text-sm text-muted-foreground">
                  Create stunning videos from text prompts using Google Veo 3.
                </p>
              </div>
              <ChevronLeft className="w-5 h-5 rotate-180 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Platform & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {platforms.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-sm">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title..." />
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <Label className="text-sm">Content</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your post content..."
                className="min-h-[100px] resize-none"
              />
            </div>

            {/* Scheduled date */}
            <div className="space-y-1.5">
              <Label className="text-sm">Scheduled date</Label>
              <Input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>

            {/* Hashtags */}
            <div className="space-y-1.5">
              <Label className="text-sm">Hashtags (comma or space separated)</Label>
              <Input
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#RebarShop #Construction"
              />
            </div>

            {/* Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                <Plus className="w-5 h-5" />
              </div>
              <p className="font-medium text-sm">Click to upload media</p>
              <p className="text-xs text-muted-foreground">PNG, JPG or MP4 up to 10MB</p>
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

            {/* Save Button */}
            <Button
              className="w-full gap-2"
              disabled={!canSave || saving}
              onClick={handleSave}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save post"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <VideoGeneratorDialog
      open={showVideoGen}
      onOpenChange={setShowVideoGen}
      onVideoReady={(url) => {
        setUploadedMedia((prev) => [...prev, { name: "ai-video.mp4", url, type: "video/mp4" }]);
        setStep("create");
      }}
    />
    </>
  );
}
