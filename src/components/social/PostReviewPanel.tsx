import { useState } from "react";
import { RefreshCw, Sparkles, CalendarDays, Trash2, Loader2, Send, ImageIcon, Video, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { usePublishPost } from "@/hooks/usePublishPost";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import { useSocialPosts, type SocialPost } from "@/hooks/useSocialPosts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ImageGeneratorDialog } from "./ImageGeneratorDialog";

import { VideoGeneratorDialog } from "./VideoGeneratorDialog";
import { SelectionSubPanel, type SelectionOption } from "./SelectionSubPanel";
import { uploadSocialMediaAsset } from "@/lib/socialMediaStorage";
import { useToast } from "@/hooks/use-toast";

interface PostReviewPanelProps {
  post: SocialPost | null;
  postsToReview: number;
  onClose: () => void;
  onSchedule: () => void;
  onDecline: () => void;
}

// ── Option lists ──

const CONTENT_TYPE_OPTIONS: SelectionOption[] = [
  { value: "post", label: "Post", description: "Regular feed post" },
  { value: "story", label: "Story", description: "24-hour temporary content" },
  { value: "reel", label: "Reel", description: "Short-form vertical video" },
];

const PLATFORM_OPTIONS: SelectionOption[] = [
  { value: "facebook", label: "Facebook", description: "Facebook" },
  { value: "instagram", label: "Instagram", description: "Instagram" },
  { value: "instagram_fb", label: "Instagram (FB Pages)", description: "Instagram (FB Pages)" },
  { value: "linkedin", label: "LinkedIn", description: "LinkedIn" },
  { value: "linkedin_org", label: "LinkedIn (Organization)", description: "LinkedIn (Organization)" },
  { value: "youtube", label: "YouTube", description: "Only single video posts supported" },
  { value: "tiktok", label: "TikTok", description: "Only single video posts supported" },
];

const PAGES_OPTIONS: SelectionOption[] = [
  { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
  { value: "Rebar.shop", label: "Rebar.shop" },
  { value: "Ontario Digital Marketing", label: "Ontario Digital Marketing" },
  { value: "Ontario Logistics", label: "Ontario Logistics" },
  { value: "Ontario Steels", label: "Ontario Steels" },
  { value: "Rebar.shop Ontario", label: "Rebar.shop Ontario" },
];

type SubPanelView = null | "content_type" | "platform" | "pages";

/* ── Date Schedule Popover ── */
function DateSchedulePopover({
  post,
  onPublishNow,
  publishing,
  onSetDate,
}: {
  post: SocialPost;
  onPublishNow: () => void;
  publishing: boolean;
  onSetDate: (date: Date) => void;
}) {
  const initDate = post.scheduled_date ? new Date(post.scheduled_date) : new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(initDate);
  const [hour, setHour] = useState(initDate.getHours().toString().padStart(2, "0"));
  const [minute, setMinute] = useState(initDate.getMinutes().toString().padStart(2, "0"));

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"));

  const handleSetDate = () => {
    const d = new Date(selectedDate);
    d.setHours(parseInt(hour), parseInt(minute), 0, 0);
    onSetDate(d);
  };

  return (
    <div className="p-3 space-y-3 pointer-events-auto">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={(d) => d && setSelectedDate(d)}
        initialFocus
        className={cn("p-3 pointer-events-auto")}
      />
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-muted-foreground font-medium">Time:</span>
        <select
          value={hour}
          onChange={(e) => setHour(e.target.value)}
          className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          {hours.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-muted-foreground font-bold">:</span>
        <select
          value={minute}
          onChange={(e) => setMinute(e.target.value)}
          className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 gap-1.5"
          onClick={onPublishNow}
          disabled={publishing}
        >
          {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Post Now
        </Button>
        <Button size="sm" className="flex-1" onClick={handleSetDate}>
          Set Date
        </Button>
      </div>
    </div>
  );
}

export function PostReviewPanel({
  post,
  postsToReview,
  onClose,
  onSchedule,
  onDecline,
}: PostReviewPanelProps) {
  const { updatePost, deletePost } = useSocialPosts();
  const { publishPost, publishing } = usePublishPost();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editHashtags, setEditHashtags] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showImageGen, setShowImageGen] = useState(false);
  const [showVideoGen, setShowVideoGen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Sub-panel state
  const [subPanel, setSubPanel] = useState<SubPanelView>(null);
  const [localContentType, setLocalContentType] = useState("post");
  const [localPages, setLocalPages] = useState<string[]>(["Ontario Steel Detailing"]);
  const [localPlatforms, setLocalPlatforms] = useState<string[]>([post?.platform || "facebook"]);

  const handleMediaReady = async (tempUrl: string, type: "image" | "video") => {
    if (!post) return;
    setUploading(true);
    try {
      const permanentUrl = await uploadSocialMediaAsset(tempUrl, type);
      updatePost.mutate({ id: post.id, image_url: permanentUrl });
      toast({ title: `${type === "image" ? "Image" : "Video"} attached`, description: "Saved to your post permanently." });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({ title: "Upload failed", description: err?.message || "Could not save media", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!post) return null;

  const startEdit = () => {
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditHashtags(post.hashtags.join(", "));
    setEditing(true);
  };

  const saveEdit = () => {
    const hashtagArray = editHashtags
      .split(/[,\s]+/)
      .map((h) => h.trim())
      .filter((h) => h.length > 0)
      .map((h) => (h.startsWith("#") ? h : `#${h}`));

    updatePost.mutate({
      id: post.id,
      title: editTitle,
      content: editContent,
      hashtags: hashtagArray,
    });
    setEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await deletePost.mutateAsync(post.id);
    setDeleting(false);
    onClose();
  };

  const platformMap: Record<string, string> = {
    facebook: "facebook",
    instagram: "instagram",
    instagram_fb: "instagram",
    linkedin: "linkedin",
    linkedin_org: "linkedin",
    youtube: "youtube",
    tiktok: "tiktok",
  };

  const handlePlatformsSaveMulti = (values: string[]) => {
    setLocalPlatforms(values);
    // Update the primary post's platform to the first selected
    if (values.length > 0) {
      const dbPlatform = platformMap[values[0]] || values[0];
      updatePost.mutate({ id: post.id, platform: dbPlatform as SocialPost["platform"] });
    }
    setSubPanel(null);
  };

  const handleContentTypeSave = (value: string) => {
    setLocalContentType(value);
    setSubPanel(null);
  };

  const handlePagesSaveMulti = (values: string[]) => {
    setLocalPages(values);
    setSubPanel(null);
  };

  const isVideo = post.image_url?.endsWith(".mp4");

  // Derive display values
  const platformsDisplay = localPlatforms.map(p => PLATFORM_OPTIONS.find(o => o.value === p)?.label || p).join(", ");
  const contentTypeDisplay = CONTENT_TYPE_OPTIONS.find((o) => o.value === localContentType)?.label || "Post";

  return (
    <>
      <Sheet open={!!post} onOpenChange={(open) => { if (!open) { setEditing(false); setSubPanel(null); onClose(); } }}>
        <SheetContent className="w-[400px] sm:w-[450px] p-0 flex flex-col">

          {/* ── Sub-panel views ── */}
          {subPanel === "content_type" && (
            <SelectionSubPanel
              title="Type"
              options={CONTENT_TYPE_OPTIONS}
              selected={localContentType}
              onSave={handleContentTypeSave}
              onBack={() => setSubPanel(null)}
            />
          )}

          {subPanel === "platform" && (
            <SelectionSubPanel
              title="Platforms"
              options={PLATFORM_OPTIONS}
              multiSelect
              selectedMulti={localPlatforms}
              onSaveMulti={handlePlatformsSaveMulti}
              onBack={() => setSubPanel(null)}
            />
          )}

          {subPanel === "pages" && (
            <SelectionSubPanel
              title="Pages"
              options={PAGES_OPTIONS}
              multiSelect
              selectedMulti={localPages}
              onSaveMulti={handlePagesSaveMulti}
              onBack={() => setSubPanel(null)}
            />
          )}

          {/* ── Main panel (hidden when sub-panel is open) ── */}
          {!subPanel && (
            <>
              {/* Header */}
              <SheetHeader className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-base font-semibold">Social media post</SheetTitle>
                  <span className="text-sm text-muted-foreground">{postsToReview} left to review</span>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto">
                {/* ── Visual Section ── */}
                <div className="p-4 space-y-3">
                  {post.image_url ? (
                    <div className="rounded-lg overflow-hidden bg-muted">
                      {isVideo ? (
                        <video src={post.image_url} controls className="w-full aspect-video object-cover" />
                      ) : (
                        <img src={post.image_url} alt="Post preview" className="w-full aspect-square object-cover" />
                      )}
                    </div>
                  ) : uploading ? (
                    <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      </div>
                      <p className="text-sm font-medium">Uploading media…</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 p-8 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No visual attached</p>
                    </div>
                  )}

                  {/* Regenerate / AI Edit buttons for visual */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={regenerating}
                      onClick={async () => {
                        setRegenerating(true);
                        try {
                          const { data, error } = await supabase.functions.invoke("regenerate-post", {
                            body: { post_id: post.id },
                          });
                          if (error) throw error;
                          if (data?.error) throw new Error(data.error);
                          queryClient.invalidateQueries({ queryKey: ["social_posts"] });
                          toast({ title: "Post regenerated", description: "New image and caption generated successfully." });
                        } catch (err: any) {
                          console.error("Regenerate error:", err);
                          toast({ title: "Regeneration failed", description: err?.message || "Could not regenerate post", variant: "destructive" });
                        } finally {
                          setRegenerating(false);
                        }
                      }}
                    >
                      {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      {regenerating ? "Regenerating..." : "Regenerate image"}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowVideoGen(true)}>
                      <Video className="w-3.5 h-3.5" />
                      {isVideo ? "Regenerate video" : "Generate video"}
                    </Button>
                  </div>
                </div>

                {/* ── Content Section ── */}
                {editing ? (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Title</Label>
                      <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Content</Label>
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[120px] resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Hashtags</Label>
                      <Input value={editHashtags} onChange={(e) => setEditHashtags(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={saveEdit}>Save changes</Button>
                      <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Content card */}
                    <div className="mx-4 rounded-lg border bg-card p-4 space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content</p>
                      <div className="space-y-2 text-sm">
                        {post.title && (
                          <p className="font-semibold text-foreground">{post.title}</p>
                        )}
                        <p className="text-foreground/90 whitespace-pre-line leading-relaxed">{post.content}</p>
                        {post.hashtags.length > 0 && (
                          <p className="text-primary text-xs leading-relaxed">
                            Hashtags: {post.hashtags.join(" ")}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Regenerate caption / AI Edit */}
                    <div className="flex gap-2 px-4 pt-3">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={startEdit}>
                        <RefreshCw className="w-3.5 h-3.5" />
                        Regenerate caption
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={startEdit}>
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Edit
                      </Button>
                    </div>

                    {/* ── Fields Section ── */}
                    <div className="px-4 pt-4 pb-4 space-y-3">
                      {/* Publish date */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="w-full rounded-lg border bg-card p-3 text-left hover:bg-muted/50 transition-colors">
                            <p className="text-xs text-muted-foreground mb-1">Publish date</p>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {post.scheduled_date
                                  ? format(new Date(post.scheduled_date), "MMMM d, yyyy 'at' h:mm a")
                                  : "Not scheduled"}
                              </span>
                              <CalendarDays className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start" side="left">
                          <DateSchedulePopover
                            post={post}
                           onPublishNow={async () => {
                              let allSuccess = true;
                              for (const pageName of localPages) {
                                const success = await publishPost({ ...post, page_name: pageName });
                                if (!success) allSuccess = false;
                              }
                              if (allSuccess) onClose();
                            }}
                            publishing={publishing}
                            onSetDate={(date) => {
                              updatePost.mutate({
                                id: post.id,
                                scheduled_date: date.toISOString(),
                                status: "scheduled",
                                qa_status: "scheduled",
                                page_name: post.page_name || localPages[0] || null,
                              });
                            }}
                          />
                        </PopoverContent>
                      </Popover>

                      {/* Content type – clickable */}
                      <button
                        onClick={() => setSubPanel("content_type")}
                        className="w-full rounded-lg border bg-card p-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <p className="text-xs text-muted-foreground mb-1">Content type</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{contentTypeDisplay}</span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </button>

                      {/* Platform – clickable (multi) */}
                      <button
                        onClick={() => setSubPanel("platform")}
                        className="w-full rounded-lg border bg-card p-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <p className="text-xs text-muted-foreground mb-1">Platforms ({localPlatforms.length})</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">{platformsDisplay}</span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      </button>

                      {/* Pages – clickable */}
                      <button
                        onClick={() => setSubPanel("pages")}
                        className="w-full rounded-lg border bg-card p-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <p className="text-xs text-muted-foreground mb-1">Pages ({localPages.length})</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">{localPages.join(", ")}</span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* ── Footer Actions ── */}
              {!editing && (
                <div className="p-4 border-t space-y-2">
                  <Button
                    className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                    onClick={async () => {
                      if (localPlatforms.length === 0) {
                        toast({ title: "No platforms selected", description: "Please select at least one platform.", variant: "destructive" });
                        return;
                      }
                      let allSuccess = true;
                      for (const plat of localPlatforms) {
                        const dbPlat = platformMap[plat] || plat;
                        for (const pageName of localPages) {
                          const success = await publishPost({ ...post, platform: dbPlat, page_name: pageName });
                          if (!success) allSuccess = false;
                        }
                      }
                      if (allSuccess) onClose();
                    }}
                    disabled={publishing}
                  >
                    {publishing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {publishing ? "Publishing..." : `Publish to ${localPlatforms.length} platform${localPlatforms.length > 1 ? "s" : ""} × ${localPages.length} page${localPages.length > 1 ? "s" : ""}`}
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={onDecline}>
                      Decline
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={async () => {
                        if (!post.scheduled_date) {
                          toast({ title: "No date set", description: "Please set a publish date first.", variant: "destructive" });
                          return;
                        }
                        if (localPages.length === 0) {
                          toast({ title: "No pages selected", description: "Please select at least one page.", variant: "destructive" });
                          return;
                        }
                        if (localPlatforms.length === 0) {
                          toast({ title: "No platforms selected", description: "Please select at least one platform.", variant: "destructive" });
                          return;
                        }

                        // Build all platform×page combos
                        const combos: { platform: string; page: string }[] = [];
                        for (const plat of localPlatforms) {
                          const dbPlat = platformMap[plat] || plat;
                          for (const page of localPages) {
                            combos.push({ platform: dbPlat, page });
                          }
                        }

                        // Primary post gets first combo
                        const [primary, ...rest] = combos;
                        updatePost.mutate(
                          {
                            id: post.id,
                            status: "scheduled",
                            qa_status: "scheduled",
                            scheduled_date: post.scheduled_date,
                            platform: primary.platform as SocialPost["platform"],
                            page_name: primary.page,
                          },
                          {
                            onSuccess: async () => {
                              for (const combo of rest) {
                                await supabase.from("social_posts").insert({
                                  user_id: post.user_id,
                                  platform: combo.platform,
                                  status: "scheduled",
                                  qa_status: "scheduled",
                                  title: post.title,
                                  content: post.content,
                                  image_url: post.image_url,
                                  scheduled_date: post.scheduled_date,
                                  hashtags: post.hashtags,
                                  page_name: combo.page,
                                  content_type: post.content_type,
                                });
                              }
                              toast({
                                title: "Post scheduled",
                                description: `Scheduled for ${format(new Date(post.scheduled_date!), "PPP p")} on ${localPlatforms.length} platform(s) × ${localPages.length} page(s)`,
                              });
                              onClose();
                            },
                          }
                        );
                      }}
                    >
                      <CalendarDays className="w-4 h-4" />
                      Schedule
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Delete post
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Image & Video Generators */}
      <ImageGeneratorDialog
        open={showImageGen}
        onOpenChange={setShowImageGen}
        onImageReady={(url) => {
          setShowImageGen(false);
          handleMediaReady(url, "image");
        }}
      />
      <VideoGeneratorDialog
        open={showVideoGen}
        onOpenChange={setShowVideoGen}
        onVideoReady={(url) => {
          setShowVideoGen(false);
          handleMediaReady(url, "video");
        }}
      />
    </>
  );
}
