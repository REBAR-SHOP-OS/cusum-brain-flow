import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Sparkles, Send, Copy, Hash, Clock, Share2, Check
} from "lucide-react";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { useSocialPosts } from "@/hooks/useSocialPosts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: "📸", ratio: "1:1" },
  { value: "facebook", label: "Facebook", icon: "📘", ratio: "16:9" },
  { value: "linkedin", label: "LinkedIn", icon: "💼", ratio: "16:9" },
  { value: "tiktok", label: "TikTok", icon: "🎵", ratio: "9:16" },
  { value: "twitter", label: "X / Twitter", icon: "🐦", ratio: "16:9" },
  { value: "youtube", label: "YouTube", icon: "▶️", ratio: "16:9" },
];

interface VideoToSocialPanelProps {
  videoUrl: string;
  aspectRatio: string;
  onClose: () => void;
}

export function VideoToSocialPanel({ videoUrl, aspectRatio, onClose }: VideoToSocialPanelProps) {
  const { toast } = useToast();
  const { createPost } = useSocialPosts();

  const [platform, setPlatform] = useState("instagram");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [suggestedTime, setSuggestedTime] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await invokeEdgeFunction("video-to-social", {
        videoUrl,
        platform,
        aspectRatio,
      });
      setCaption(data.caption || "");
      setHashtags(data.hashtags || []);
      setTitle(data.title || "Video Post");
      setSuggestedTime(data.suggestedTime || "10:00");
      setGenerated(true);
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveAsPost = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fullContent = caption + (hashtags.length > 0 ? "\n\n" + hashtags.join(" ") : "");

      await createPost.mutateAsync({
        platform,
        user_id: user.id,
        title: title || "Video Post",
        content: fullContent,
        media_urls: [videoUrl],
        status: "draft",
        hashtags: hashtags.join(" "),
      } as any);

      toast({ title: "Post created!", description: `Saved as draft for ${platform}` });
      onClose();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCaption = () => {
    const text = caption + (hashtags.length > 0 ? "\n\n" + hashtags.join(" ") : "");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedPlatform = PLATFORMS.find(p => p.value === platform);
  const recommendedRatio = selectedPlatform?.ratio || "16:9";
  const ratioMismatch = aspectRatio !== recommendedRatio;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Share2 className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Create Social Post</span>
      </div>

      {/* Platform selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">Platform</Label>
        <div className="grid grid-cols-3 gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              onClick={() => { setPlatform(p.value); setGenerated(false); }}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs transition-all ${
                platform === p.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <span>{p.icon}</span>
              <span className="font-medium">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ratio warning */}
      {ratioMismatch && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
          <span className="text-xs text-amber-600">
            ⚠️ Video is {aspectRatio} but {selectedPlatform?.label} prefers {recommendedRatio}
          </span>
        </div>
      )}

      {/* Generate button */}
      {!generated && (
        <Button className="w-full gap-2" onClick={handleGenerate} disabled={generating}>
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? "Generating caption & hashtags..." : "Auto-Generate Post Content"}
        </Button>
      )}

      {/* Generated content */}
      {generated && (
        <>
          {/* Caption */}
          <div className="space-y-1.5">
            <Label className="text-xs">Caption</Label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="min-h-[100px] text-sm resize-none"
            />
          </div>

          {/* Hashtags */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Hash className="w-3 h-3 text-muted-foreground" />
              <Label className="text-xs">Hashtags</Label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hashtags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] cursor-pointer hover:bg-destructive/20"
                  onClick={() => setHashtags(prev => prev.filter((_, idx) => idx !== i))}
                >
                  {tag} ×
                </Badge>
              ))}
            </div>
          </div>

          {/* Suggested time */}
          {suggestedTime && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              Suggested posting time: <span className="font-medium text-foreground">{suggestedTime}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button className="flex-1 gap-2" onClick={handleSaveAsPost} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {saving ? "Saving..." : "Save as Draft Post"}
            </Button>
            <Button variant="outline" size="icon" onClick={handleCopyCaption}>
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setGenerated(false); }}>
            Regenerate for different platform
          </Button>
        </>
      )}
    </div>
  );
}
