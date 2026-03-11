import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Sparkles, CalendarDays, Trash2, Loader2, ImageIcon, Video, ChevronDown, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

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
import { usePublishPost } from "@/hooks/usePublishPost";
import { schedulePost } from "@/lib/schedulePost";

interface PostReviewPanelProps {
  post: SocialPost | null;
  groupPages?: string[];
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

const PLATFORM_PAGES: Record<string, SelectionOption[]> = {
  facebook: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Rebar.shop", label: "Rebar.shop" },
    { value: "Ontario Digital Marketing", label: "Ontario Digital Marketing" },
    { value: "Ontario Logistics", label: "Ontario Logistics" },
    { value: "Ontario Steels", label: "Ontario Steels" },
    { value: "Rebar.shop Ontario", label: "Rebar.shop Ontario" },
  ],
  instagram: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Rebar.shop", label: "Rebar.shop" },
    { value: "Ontario Digital Marketing", label: "Ontario Digital Marketing" },
    { value: "Ontario Logistics", label: "Ontario Logistics" },
    { value: "Ontario Steels", label: "Ontario Steels" },
    { value: "Rebar.shop Ontario", label: "Rebar.shop Ontario" },
  ],
  instagram_fb: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Rebar.shop", label: "Rebar.shop" },
    { value: "Ontario Digital Marketing", label: "Ontario Digital Marketing" },
    { value: "Ontario Logistics", label: "Ontario Logistics" },
    { value: "Ontario Steels", label: "Ontario Steels" },
    { value: "Rebar.shop Ontario", label: "Rebar.shop Ontario" },
  ],
  linkedin: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Ontario Logistics", label: "Ontario Logistics" },
  ],
  linkedin_org: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
  ],
  youtube: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
  ],
  tiktok: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
  ],
};

type SubPanelView = null | "content_type" | "platform" | "pages";

/* ── Date Schedule Popover ── */
function DateSchedulePopover({
  post,
  onSetDate,
}: {
  post: SocialPost;
  onSetDate: (date: Date) => void;
}) {
  const initDate = post.scheduled_date ? new Date(post.scheduled_date) : new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(initDate);
  const [hour, setHour] = useState(initDate.getHours().toString().padStart(2, "0"));
  const [minute, setMinute] = useState(initDate.getMinutes().toString().padStart(2, "0"));

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"));

  const { toast } = useToast();

  const handleSetDate = () => {
    const d = new Date(selectedDate);
    d.setHours(parseInt(hour), parseInt(minute), 0, 0);
    if (d <= new Date()) {
      toast({ title: "Invalid Time", description: "Cannot schedule in the past. Please select a future time.", variant: "destructive" });
      return;
    }
    onSetDate(d);
  };

  return (
    <div className="p-3 space-y-3 pointer-events-auto">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={(d) => d && setSelectedDate(d)}
        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
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
      <Button size="sm" className="w-full" onClick={handleSetDate}>
        <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
        Set Date
      </Button>
    </div>
  );
}

export function PostReviewPanel({
  post,
  groupPages,
  postsToReview,
  onClose,
  onSchedule,
  onDecline,
}: PostReviewPanelProps) {
  const { posts: allPosts, updatePost, deletePost } = useSocialPosts();
  const { toast } = useToast();
  const { publishPost, publishing } = usePublishPost();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [approvingNeel, setApprovingNeel] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editHashtags, setEditHashtags] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showImageGen, setShowImageGen] = useState(false);
  const [showVideoGen, setShowVideoGen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const isPublished = post?.status === "published";

  // Fetch current user email for Neel approval gate
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserEmail(data.user?.email ?? null);
    });
  }, []);

  // Sub-panel state
  const [subPanel, setSubPanel] = useState<SubPanelView>(null);
  const [localContentType, setLocalContentType] = useState(post?.content_type || "post");
  const [localPages, setLocalPages] = useState<string[]>(post?.page_name ? [post.page_name] : ["Ontario Steel Detailing"]);
  const [localPlatforms, setLocalPlatforms] = useState<string[]>([post?.platform || "facebook"]);

  // Sync local state when post changes (navigation or refresh)
  useEffect(() => {
    if (!post) return;
    setLocalPlatforms([post.platform]);
    if (groupPages && groupPages.length > 0) {
      setLocalPages(groupPages);
    } else {
      setLocalPages(post.page_name ? [post.page_name] : ["Ontario Steel Detailing"]);
    }
    setLocalContentType(post.content_type || "post");
  }, [post?.id, groupPages]);

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

  const filteredPageOptions = useMemo(() => {
    const seen = new Set<string>();
    return localPlatforms.flatMap(p => PLATFORM_PAGES[p] || []).filter(o => {
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    });
  }, [localPlatforms]);

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
    // Reset pages to only valid ones for new platform selection
    const validPages = new Set(values.flatMap(p => (PLATFORM_PAGES[p] || []).map(o => o.value)));
    setLocalPages(prev => prev.filter(p => validPages.has(p)));
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
  const platformsDisplay = localPlatforms.length === PLATFORM_OPTIONS.length
    ? "All"
    : localPlatforms.map(p => PLATFORM_OPTIONS.find(o => o.value === p)?.label || p).join(", ");
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
              options={filteredPageOptions}
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
                      {isPublished ? (
                        <div className="w-full rounded-lg border bg-card p-3 opacity-60 cursor-not-allowed">
                          <p className="text-xs text-muted-foreground mb-1">Publish date</p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {post.scheduled_date
                                ? format(new Date(post.scheduled_date), "MMMM d, yyyy 'at' h:mm a")
                                : "Not scheduled"}
                            </span>
                            <CalendarDays className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      ) : (
                      <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
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
                           onSetDate={async (date) => {
                              console.log(`[PostReviewPanel] Set Date only — post=${post.id} date=${date.toISOString()}`);
                              const { error } = await supabase
                                .from("social_posts")
                                .update({ scheduled_date: date.toISOString() })
                                .eq("id", post.id);
                              if (error) {
                                console.error("[PostReviewPanel] Set Date FAILED:", error.message);
                                toast({ title: "Failed to set date", description: error.message, variant: "destructive" });
                                return;
                              }
                              queryClient.invalidateQueries({ queryKey: ["social_posts"] });
                              setDatePopoverOpen(false);
                              toast({ title: "Date set", description: format(date, "PPP p") });
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      )}

                      {/* Content type – clickable */}
                      <button
                        onClick={() => !isPublished && setSubPanel("content_type")}
                        className={cn("w-full rounded-lg border bg-card p-3 text-left transition-colors", isPublished ? "opacity-60 cursor-not-allowed" : "hover:bg-muted/50")}
                      >
                        <p className="text-xs text-muted-foreground mb-1">Content type</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{contentTypeDisplay}</span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </button>

                      {/* Platform – clickable (multi) */}
                      <button
                        onClick={() => !isPublished && setSubPanel("platform")}
                        className={cn("w-full rounded-lg border bg-card p-3 text-left transition-colors", isPublished ? "opacity-60 cursor-not-allowed" : "hover:bg-muted/50")}
                      >
                        <p className="text-xs text-muted-foreground mb-1">Platforms ({localPlatforms.length})</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">{platformsDisplay}</span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      </button>

                      {/* Pages – clickable */}
                      <button
                        onClick={() => !isPublished && setSubPanel("pages")}
                        className={cn("w-full rounded-lg border bg-card p-3 text-left transition-colors", isPublished ? "opacity-60 cursor-not-allowed" : "hover:bg-muted/50")}
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
              {/* Failed status banner + retry */}
              {!editing && post.status === "failed" && (
                <div className="p-4 border-t space-y-2">
                  <div className="w-full rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-center space-y-1">
                    <span className="text-sm font-medium text-destructive">Publishing Failed ❌</span>
                    {(post as any).last_error && (
                      <p className="text-xs text-destructive/80 break-words">{(post as any).last_error}</p>
                    )}
                  </div>
                  <Button
                    className="w-full gap-1.5"
                    variant="outline"
                    onClick={async () => {
                      await updatePost.mutateAsync({ id: post.id, status: "scheduled", qa_status: "scheduled", last_error: null } as any);
                      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
                      toast({ title: "Post rescheduled", description: "Post has been moved back to scheduled for retry." });
                    }}
                  >
                    <RefreshCw className="w-4 h-4" /> Retry Publishing
                  </Button>
                </div>
              )}
              {!editing && isPublished && (
                <div className="p-4 border-t">
                  <div className="w-full rounded-lg bg-green-600/10 border border-green-600/30 p-3 text-center">
                    <span className="text-sm font-medium text-green-600">Published ✅</span>
                  </div>
                </div>
              )}
              {!editing && !isPublished && (
                <div className="p-4 border-t space-y-2">
                  {/* Neel Approval Gate */}
                  {post.neel_approved ? (
                    <Button
                      disabled
                      className="w-full bg-green-50 border border-green-200 text-green-700 hover:bg-green-50 gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Approved by Neel ✅
                    </Button>
                  ) : currentUserEmail === "neel@rebar.shop" ? (
                    <Button
                      variant="outline"
                      className="w-full border-amber-400 text-amber-700 hover:bg-amber-50 gap-1.5"
                      disabled={approvingNeel}
                      onClick={async () => {
                        setApprovingNeel(true);
                        try {
                          const batchPosts = post.image_url
                            ? allPosts.filter(p => p.image_url === post.image_url)
                            : [post];
                          for (const p of batchPosts) {
                            await updatePost.mutateAsync({ id: p.id, neel_approved: true } as any);
                          }
                          toast({ title: "Approved", description: `${batchPosts.length} post(s) approved by Neel.` });
                        } finally {
                          setApprovingNeel(false);
                        }
                      }}
                    >
                      {approvingNeel ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Approving...</>
                      ) : (
                        <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> Neel Approval</>
                      )}
                    </Button>
                  ) : (
                    <Button
                      disabled
                      variant="outline"
                      className="w-full gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Awaiting Neel's Approval
                    </Button>
                  )}

                  {/* Publish Now */}
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white gap-1.5"
                    disabled={publishing}
                    onClick={async () => {
                      // Neel approval guard
                      if (!post.neel_approved) {
                        toast({ title: "Neel Approval Required", description: "This post must be approved by Neel before publishing.", variant: "destructive" });
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

                      const combos: { platform: string; page: string }[] = [];
                      for (const plat of localPlatforms) {
                        const dbPlat = platformMap[plat] || plat;
                        for (const page of localPages) {
                          combos.push({ platform: dbPlat, page });
                        }
                      }

                      let allOk = true;
                      for (const combo of combos) {
                        const ok = await publishPost({
                          id: post.id,
                          platform: combo.platform,
                          content: post.content,
                          title: post.title,
                          hashtags: post.hashtags,
                          image_url: post.image_url,
                          page_name: combo.page,
                        });
                        if (!ok) allOk = false;
                      }
                      if (allOk) onClose();
                    }}
                  >
                    {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {publishing ? "Publishing..." : "Publish Now"}
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

                        if ((post.content || "").length < 20) {
                          toast({ title: "Content too short", description: "Post content must be at least 20 characters to schedule.", variant: "destructive" });
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
                        const postId = post.id;

                        // Block scheduling in the past
                        if (!post.scheduled_date || new Date(post.scheduled_date) <= new Date()) {
                          toast({ title: "Invalid Time", description: "Cannot schedule in the past. Please select a future time.", variant: "destructive" });
                          return;
                        }

                        console.log(`[PostReviewPanel] Schedule button — post=${postId} platform=${primary.platform} page=${primary.page} date=${post.scheduled_date}`);
                        const result = await schedulePost({
                          post_id: postId,
                          scheduled_date: post.scheduled_date!,
                          status: "scheduled",
                          qa_status: "scheduled",
                          platform: primary.platform,
                          page_name: primary.page,
                          extra_combos: rest.length > 0 ? rest.map(c => ({ platform: c.platform, page: c.page })) : undefined,
                        });
                        if (!result.success) {
                          console.error("[PostReviewPanel] Schedule FAILED:", result.error, result.details);
                          toast({
                            title: "Scheduling failed",
                            description: result.error || "Post could not be scheduled. Check permissions and try again.",
                            variant: "destructive",
                          });
                          return;
                        }
                        queryClient.invalidateQueries({ queryKey: ["social_posts"] });
                        toast({
                          title: "Post scheduled ✅",
                          description: `Scheduled for ${format(new Date(post.scheduled_date!), "PPP p")} on ${localPlatforms.length} platform(s) × ${localPages.length} page(s)`,
                        });
                        onClose();
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
