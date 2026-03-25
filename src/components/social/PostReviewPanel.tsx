import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { RefreshCw, Sparkles, CalendarDays, Trash2, Loader2, ImageIcon, Video, ChevronDown, Send, Upload, Smartphone, ChevronRight, ZoomIn, Pencil, Check, Play, Copy } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PLATFORM_PAGES } from "@/lib/socialConstants";

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
import { ImageEditDialog } from "./ImageEditDialog";

import { VideoGeneratorDialog } from "./VideoGeneratorDialog";
import { SelectionSubPanel, type SelectionOption } from "./SelectionSubPanel";
import { uploadSocialMediaAsset } from "@/lib/socialMediaStorage";
import { useToast } from "@/hooks/use-toast";
import { usePublishPost } from "@/hooks/usePublishPost";
import { schedulePost } from "@/lib/schedulePost";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

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

// PLATFORM_PAGES imported from @/lib/socialConstants

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
  const { posts: allPosts, updatePost, deletePost, createPost } = useSocialPosts();
  const { toast } = useToast();
  const { publishPost, publishing } = usePublishPost();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canPublish = user?.email === "radin@rebar.shop" || user?.email === "zahra@rebar.shop";
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratingCaption, setRegeneratingCaption] = useState(false);
  const [approvingNeel, setApprovingNeel] = useState(false);
  // Always-editable local state for auto-save
  const [localTitle, setLocalTitle] = useState(post?.title || "");
  const [localContent, setLocalContent] = useState(post?.content || "");
  const [localHashtags, setLocalHashtags] = useState(post?.hashtags?.join(", ") || "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [persianImageText, setPersianImageText] = useState("");
  const [persianCaptionText, setPersianCaptionText] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const [showImageGen, setShowImageGen] = useState(false);
  const [showVideoGen, setShowVideoGen] = useState(false);
  const [showStoryGen, setShowStoryGen] = useState(false); // rebuild-trigger-v1
  const [showImageEdit, setShowImageEdit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [repostPopoverOpen, setRepostPopoverOpen] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [fbPublishReady, setFbPublishReady] = useState<boolean | null>(null);
  const [fbMissingScopes, setFbMissingScopes] = useState<string[]>([]);

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

  // Check Facebook publish_ready status
  useEffect(() => {
    if (!post) return;
    const hasFb = localPlatforms.some(p => p === "facebook" || p === "instagram" || p === "instagram_fb");
    if (!hasFb) { setFbPublishReady(null); return; }

    supabase
      .from("integration_connections")
      .select("config")
      .eq("integration_id", "facebook")
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.config) { setFbPublishReady(null); return; }
        const cfg = data.config as any;
        setFbPublishReady(cfg.publish_ready ?? null);
        setFbMissingScopes(cfg.missing_scopes ?? []);
      });
  }, [post?.id, localPlatforms]);

   // Reset video player view when post changes
  useEffect(() => { setShowVideoPlayer(false); }, [post?.id]);

   // Sync local state when post changes (navigation, refresh, or platform/content_type update)
  useEffect(() => {
    if (!post) return;
    setLocalPlatforms([post.platform]);
    if (groupPages && groupPages.length > 0) {
      setLocalPages(groupPages);
    } else {
      setLocalPages(post.page_name ? post.page_name.split(", ").filter(Boolean) : ["Ontario Steel Detailing"]);
    }
    setLocalContentType(post.content_type || "post");
    // Sync text fields from post data — strip Persian block from editable content
    setLocalTitle(post.title || "");
    const rawC = post.content || "";
    const persianSepIdx = rawC.indexOf("---PERSIAN---");
    if (persianSepIdx !== -1) {
      setLocalContent(rawC.slice(0, persianSepIdx).trim());
      const pBlock = rawC.slice(persianSepIdx + "---PERSIAN---".length).trim();
      // Parse image text and caption translation from Persian block
      const imgMatch = pBlock.match(/🖼️\s*متن روی عکس:\s*([\s\S]*?)(?=📝|$)/);
      const capMatch = pBlock.match(/📝\s*ترجمه کپشن:\s*([\s\S]*?)$/);
      setPersianImageText(imgMatch?.[1]?.trim() || pBlock);
      setPersianCaptionText(capMatch?.[1]?.trim() || "");
    } else {
      setLocalContent(rawC);
      setPersianImageText("");
      setPersianCaptionText("");
    }
    setLocalHashtags(post.hashtags?.join(", ") || "");
    setSaveStatus("idle");
  }, [post?.id, post?.platform, post?.content_type, post?.page_name, groupPages, post?.title, post?.content, post?.hashtags]);

  const handleMediaReady = async (tempUrl: string, type: "image" | "video") => {
    if (!post) return;
    setUploading(true);
    try {
      const permanentUrl = await uploadSocialMediaAsset(tempUrl, type);
      updatePost.mutate({ id: post.id, image_url: permanentUrl });
      toast({ title: `${type === "image" ? "Image" : "Video"} attached`, description: "Saved to your post permanently." });

      // Auto-generate general caption for video uploads (skip for stories)
      if (type === "video" && localContentType !== "story") {
        setRegeneratingCaption(true);
        try {
          // Hybrid: try video-to-social first for context-aware caption
          const videoData = await invokeEdgeFunction("video-to-social", {
            videoUrl: permanentUrl, platform: post.platform || "instagram", aspectRatio: "1:1"
          }, { timeoutMs: 60000 });
          // Apply video-to-social result to the post
          const fullContent = (videoData.caption || "") + (videoData.hashtags?.length ? "\n\n" + videoData.hashtags.join(" ") : "");
          updatePost.mutate({ id: post.id, title: videoData.title || post.title, content: fullContent });
          queryClient.invalidateQueries({ queryKey: ["social_posts"] });
          toast({ title: "Caption generated", description: "Video-aware caption created for your post." });
        } catch (videoErr: any) {
          console.warn("video-to-social failed, falling back to regenerate-post:", videoErr?.message);
          try {
            await invokeEdgeFunction("regenerate-post", { post_id: post.id, caption_only: true, is_video: true }, { timeoutMs: 120000 });
            queryClient.invalidateQueries({ queryKey: ["social_posts"] });
            toast({ title: "Caption generated", description: "A general promotional caption was created for your video." });
          } catch (err: any) {
            console.error("Auto caption fallback error:", err);
          }
        } finally {
          setRegeneratingCaption(false);
        }
      }
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

  // Debounced auto-save for text fields
  const flushSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!post) return;
    const hashtagArray = localHashtags
      .split(/[,\s]+/)
      .map((h) => h.trim())
      .filter((h) => h.length > 0)
      .map((h) => (h.startsWith("#") ? h : `#${h}`));
    setSaveStatus("saving");
    // Re-append Persian block so it's preserved in DB but never in the editable textarea
    let contentToSave = localContent;
    if (persianImageText || persianCaptionText) {
      contentToSave += "\n\n---PERSIAN---\n🖼️ متن روی عکس: " + (persianImageText || "") + "\n📝 ترجمه کپشن: " + (persianCaptionText || "");
    }
    updatePost.mutate(
      { id: post.id, title: localTitle, content: contentToSave, hashtags: hashtagArray },
      { onSuccess: () => { setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 2000); },
        onError: () => setSaveStatus("idle") }
    );
  }, [post?.id, localTitle, localContent, localHashtags, persianImageText, persianCaptionText, updatePost]);

  const flushRef = useRef(flushSave);
  flushRef.current = flushSave;

  const triggerDebouncedSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => flushRef.current(), 800);
  }, []);

  // Flush pending save on post switch or panel close
  const prevPostIdRef = useRef(post?.id);
  useEffect(() => {
    if (prevPostIdRef.current && prevPostIdRef.current !== post?.id) {
      flushRef.current();
    }
    prevPostIdRef.current = post?.id;
  }, [post?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) { clearTimeout(debounceRef.current); flushRef.current(); } };
  }, []);

  if (!post) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Find all sibling posts in the same calendar card (same platform + title + day)
      const postDay = post.scheduled_date?.substring(0, 10);
      const siblings = allPosts.filter(p =>
        p.platform === post.platform &&
        p.title === post.title &&
        p.scheduled_date?.substring(0, 10) === postDay
      );
      const idsToDelete = siblings.length > 0 ? siblings.map(s => s.id) : [post.id];

      await Promise.all(idsToDelete.map(id => deletePost.mutateAsync(id)));
      toast({ title: "Deleted", description: `${idsToDelete.length} post(s) deleted.` });
    } finally {
      setDeleting(false);
      onClose();
    }
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

  const handlePlatformsSaveMulti = async (values: string[]) => {
    // Sanitize: strip "unassigned" when real platforms are selected
    const realValues = values.filter(v => v !== "unassigned");
    const sanitized = realValues.length > 0 ? realValues : values;
    setLocalPlatforms(sanitized);
    // Reset pages to only valid ones for new platform selection
    const validPages = new Set(sanitized.flatMap(p => (PLATFORM_PAGES[p] || []).map(o => o.value)));
    setLocalPages(prev => prev.filter(p => validPages.has(p)));

    // Map UI platform keys to DB platform values
    const dbPlatforms = sanitized.map(p => platformMap[p] || p);

    // Reconcile sibling rows: find all siblings for this title + day
    const day = post.scheduled_date?.substring(0, 10);
    const siblings = allPosts.filter(p =>
      p.title === post.title &&
      (day ? p.scheduled_date?.substring(0, 10) === day : p.id === post.id)
    );
    const existingPlatforms = [...new Set(siblings.map(s => s.platform))];
    const targetSet = new Set(dbPlatforms);

    // Delete siblings whose platform is no longer selected
    const toDelete = siblings.filter(s => !targetSet.has(s.platform));
    // Platforms that need new rows
    const existingSet = new Set(existingPlatforms);
    const toAdd = dbPlatforms.filter(p => !existingSet.has(p));
    // Update existing siblings to keep them (in case platform value changed)
    const toUpdate = siblings.filter(s => targetSet.has(s.platform));

    const promises: PromiseLike<any>[] = [];

    for (const sib of toDelete) {
      promises.push(supabase.from("social_posts").delete().eq("id", sib.id).select());
    }

    for (const newPlatform of toAdd) {
      // Clone from first existing sibling for each page
      const templateSiblings = toUpdate.length > 0 ? toUpdate : [post];
      const seenPages = new Set<string>();
      for (const tmpl of templateSiblings) {
        const pageKey = tmpl.page_name || "";
        if (seenPages.has(pageKey)) continue;
        seenPages.add(pageKey);
        promises.push(
          supabase.from("social_posts").insert({
            user_id: post.user_id,
            platform: newPlatform as SocialPost["platform"],
            status: post.status,
            qa_status: post.qa_status,
            title: post.title,
            content: post.content,
            image_url: post.image_url,
            scheduled_date: post.scheduled_date,
            hashtags: post.hashtags,
            page_name: tmpl.page_name,
            content_type: post.content_type,
            neel_approved: post.neel_approved,
          }).select()
        );
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
    queryClient.invalidateQueries({ queryKey: ["social_posts"] });
    setSubPanel(null);
  };

  const handleContentTypeSave = async (value: string) => {
    setLocalContentType(value);
    // Batch update all siblings (same title + platform + day)
    const day = post.scheduled_date?.substring(0, 10);
    let query = supabase
      .from("social_posts")
      .update({ content_type: value })
      .eq("platform", post.platform)
      .eq("title", post.title);
    if (day) {
      query = query.gte("scheduled_date", `${day}T00:00:00`).lte("scheduled_date", `${day}T23:59:59`);
    } else {
      query = query.eq("id", post.id);
    }
    const { error } = await query;
    if (error) {
      toast({ title: "Failed to update content type", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
    }
    setSubPanel(null);
  };

  const handlePagesSaveMulti = async (values: string[]) => {
    setLocalPages(values);
    // Reconcile sibling rows: find all siblings for this title + platform + day
    const day = post.scheduled_date?.substring(0, 10);
    const siblings = allPosts.filter(p =>
      p.title === post.title &&
      p.platform === post.platform &&
      (day ? p.scheduled_date?.substring(0, 10) === day : p.id === post.id)
    );
    const existingPageMap = new Map(siblings.map(s => [s.page_name || "", s]));
    const selectedSet = new Set(values);

    // Delete siblings whose page is no longer selected
    const toDelete = siblings.filter(s => !selectedSet.has(s.page_name || ""));
    // Create new rows for newly selected pages
    const existingPages = new Set(siblings.map(s => s.page_name || ""));
    const toAdd = values.filter(p => !existingPages.has(p));

    const promises: PromiseLike<any>[] = [];
    for (const sib of toDelete) {
      promises.push(supabase.from("social_posts").delete().eq("id", sib.id).select());
    }
    for (const pageName of toAdd) {
      promises.push(
        supabase.from("social_posts").insert({
          user_id: post.user_id,
          platform: post.platform,
          status: post.status,
          qa_status: post.qa_status,
          title: post.title,
          content: post.content,
          image_url: post.image_url,
          scheduled_date: post.scheduled_date,
          hashtags: post.hashtags,
          page_name: pageName,
          content_type: post.content_type,
          neel_approved: post.neel_approved,
        }).select()
      );
    }
    if (promises.length > 0) {
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
    }
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
      <Sheet open={!!post} onOpenChange={(open) => { if (!open) { flushRef.current(); setSubPanel(null); onClose(); } }}>
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
                    <div className="rounded-lg overflow-hidden bg-muted relative group">
                      {isVideo ? (
                        <>
                          {(post as any).cover_image_url && !showVideoPlayer ? (
                            <div className="relative cursor-pointer" onClick={() => setShowVideoPlayer(true)}>
                              <img
                                src={(post as any).cover_image_url}
                                alt="Video thumbnail"
                                className="w-full object-cover rounded-lg"
                                style={{ maxHeight: '400px' }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                                  <Play className="w-6 h-6 text-white ml-0.5" />
                                </div>
                              </div>
                              <span className="absolute bottom-2 left-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded">
                                Thumbnail
                              </span>
                            </div>
                          ) : (
                            <video src={post.image_url} controls className="w-full rounded-lg" style={{ maxHeight: '400px' }} />
                          )}
                        </>
                      ) : (
                        <>
                          <img src={post.image_url} alt="Post preview" className="w-full object-contain rounded-lg" />
                          <button
                            onClick={() => setImageZoomOpen(true)}
                            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ZoomIn className="w-4 h-4" />
                          </button>
                        </>
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
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={regenerating}
                        onClick={async () => {
                          setRegenerating(true);
                          try {
                            const data = await invokeEdgeFunction("regenerate-post", { post_id: post.id, is_video: !!isVideo }, { timeoutMs: 120000 });
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
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowImageGen(true)}>
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Image
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowVideoGen(true)}>
                        <Video className="w-3.5 h-3.5" />
                        {isVideo ? "Regenerate video" : "Generate video"}
                      </Button>
                      <label>
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const blobUrl = URL.createObjectURL(file);
                            handleMediaReady(blobUrl, "video");
                            e.target.value = "";
                          }}
                        />
                        <Button variant="outline" size="sm" className="gap-1.5" asChild>
                          <span>
                            <Upload className="w-3.5 h-3.5" />
                            Upload Video
                          </span>
                        </Button>
                      </label>
                     </div>
                     <div className="flex gap-2 flex-wrap">
                       <label>
                         <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const blobUrl = URL.createObjectURL(file);
                              handleMediaReady(blobUrl, "image");
                              e.target.value = "";
                            }}
                          />
                          <Button variant="outline" size="sm" className="gap-1.5" asChild>
                            <span>
                              <Upload className="w-3.5 h-3.5" />
                              Upload Image
                            </span>
                          </Button>
                        </label>
                        {post?.image_url && !isVideo && (
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowImageEdit(true)}>
                            <Pencil className="w-3.5 h-3.5" />
                            Edit Image
                          </Button>
                        )}
                        {isVideo && (
                          <label>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !post) return;
                                e.target.value = "";
                                try {
                                  const blobUrl = URL.createObjectURL(file);
                                  const coverUrl = await uploadSocialMediaAsset(blobUrl, "image");
                                  await supabase
                                    .from("social_posts")
                                    .update({ cover_image_url: coverUrl } as any)
                                    .eq("id", post.id);
                                  queryClient.invalidateQueries({ queryKey: ["social_posts"] });
                                  toast({ title: "Cover uploaded", description: "Cover image saved for this video post." });
                                } catch (err: any) {
                                  toast({ title: "Upload failed", description: err?.message || "Could not upload cover image.", variant: "destructive" });
                                }
                              }}
                            />
                            <Button variant="outline" size="sm" className="gap-1.5" asChild>
                              <span>
                                <ImageIcon className="w-3.5 h-3.5" />
                                Upload Cover
                              </span>
                            </Button>
                          </label>
                        )}
                      </div>
                     <div className="flex gap-2 flex-wrap">
                       <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowStoryGen(true)}>
                         <Smartphone className="w-3.5 h-3.5" />
                         Auto Generate Story
                       </Button>
                       <Popover open={repostPopoverOpen} onOpenChange={setRepostPopoverOpen}>
                         <PopoverTrigger asChild>
                           <Button variant="outline" size="sm" className="gap-1.5">
                             <Copy className="w-3.5 h-3.5" />
                             Repost
                           </Button>
                         </PopoverTrigger>
                         <PopoverContent className="w-auto p-0" align="start" side="top">
                           <DateSchedulePopover
                             post={post}
                             onSetDate={async (newDate) => {
                               if (!post || reposting) return;
                               setReposting(true);
                               try {
                                 const postAny = post as any;
                                 const { error } = await supabase.from("social_posts").insert({
                                   title: post.title,
                                   content: post.content,
                                   image_url: post.image_url,
                                   cover_image_url: postAny.cover_image_url || null,
                                   hashtags: post.hashtags,
                                   platform: post.platform,
                                   page_name: post.page_name,
                                   content_type: post.content_type,
                                   user_id: post.user_id,
                                   scheduled_date: newDate.toISOString(),
                                   status: "scheduled",
                                   qa_status: "scheduled",
                                   neel_approved: false,
                                 });
                                 if (error) throw error;
                                 queryClient.invalidateQueries({ queryKey: ["social_posts"] });
                                 toast({ title: "Repost created ✅", description: `Cloned to ${format(newDate, "PPP")} at ${format(newDate, "HH:mm")}` });
                                 setRepostPopoverOpen(false);
                               } catch (err: any) {
                                 toast({ title: "Repost failed", description: err.message, variant: "destructive" });
                               } finally {
                                 setReposting(false);
                               }
                             }}
                           />
                         </PopoverContent>
                       </Popover>
                     </div>
                  </div>
                </div>

                {/* ── Content Section (hidden for Stories) ── */}
                {localContentType === "story" ? (
                  <div className="mx-4 rounded-lg border bg-muted/30 p-4 text-center">
                    <p className="text-sm text-muted-foreground">Stories are image/video only — no caption needed.</p>
                  </div>
                ) : (
                  <>
                    {/* Always-editable content fields with auto-save */}
                    <div className="px-4 pb-2 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content</p>
                        {saveStatus === "saving" && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Saving…
                          </span>
                        )}
                        {saveStatus === "saved" && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Saved ✓
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Title</Label>
                        <Input
                          value={localTitle}
                          disabled={isPublished}
                          onChange={(e) => { setLocalTitle(e.target.value); triggerDebouncedSave(); }}
                          placeholder="Post title"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Caption</Label>
                        <Textarea
                          ref={captionRef}
                          value={localContent}
                          disabled={isPublished}
                          onChange={(e) => { setLocalContent(e.target.value); triggerDebouncedSave(); }}
                          placeholder="Write your caption…"
                          className="min-h-[120px] resize-none text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Hashtags</Label>
                        <Input
                          value={localHashtags}
                          disabled={isPublished}
                          onChange={(e) => { setLocalHashtags(e.target.value); triggerDebouncedSave(); }}
                          placeholder="#hashtag1, #hashtag2"
                          className="text-sm"
                        />
                      </div>
                    </div>

                    {/* Persian translation — always visible, read-only, never published */}
                    <div className="mx-3 my-2 p-2.5 rounded-lg bg-muted/50 border border-border/50">
                      <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1.5">
                        🔒 Internal reference only — not published
                      </p>
                      <div className="mb-1.5">
                        <p className="text-[10px] font-medium text-muted-foreground">🖼️ Image text:</p>
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line" dir="rtl">
                          {persianImageText || "ترجمه‌ای موجود نیست"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground">📝 Caption translation:</p>
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line" dir="rtl">
                          {persianCaptionText || "ترجمه‌ای موجود نیست"}
                        </p>
                      </div>
                    </div>

                    {/* Regenerate caption */}
                    <div className="flex gap-2 px-4 pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={regeneratingCaption || isPublished}
                        onClick={async () => {
                          setRegeneratingCaption(true);
                          try {
                            if (isVideo && post.image_url) {
                              try {
                                const videoData = await invokeEdgeFunction("video-to-social", {
                                  videoUrl: post.image_url, platform: post.platform || "instagram", aspectRatio: "1:1"
                                }, { timeoutMs: 60000 });
                                const fullContent = (videoData.caption || "") + (videoData.hashtags?.length ? "\n\n" + videoData.hashtags.join(" ") : "");
                                updatePost.mutate({ id: post.id, title: videoData.title || post.title, content: fullContent });
                                queryClient.invalidateQueries({ queryKey: ["social_posts"] });
                                toast({ title: "Caption regenerated", description: "Video-aware caption generated." });
                                return;
                              } catch {
                                console.warn("video-to-social failed, falling back to regenerate-post");
                              }
                            }
                            await invokeEdgeFunction("regenerate-post", { post_id: post.id, caption_only: true, is_video: !!isVideo }, { timeoutMs: 120000 });
                            queryClient.invalidateQueries({ queryKey: ["social_posts"] });
                            toast({ title: "Caption regenerated", description: "New caption generated." });
                          } catch (err: any) {
                            console.error("Caption regen error:", err);
                            toast({ title: "Caption regeneration failed", description: err?.message || "Could not regenerate caption", variant: "destructive" });
                          } finally {
                            setRegeneratingCaption(false);
                          }
                        }}
                      >
                        {regeneratingCaption ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        {regeneratingCaption ? "Regenerating..." : "Regenerate caption"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={isPublished}
                        onClick={() => {
                          captionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                          setTimeout(() => captionRef.current?.focus(), 300);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit caption
                      </Button>
                    </div>
                  </>
                )}

                {/* ── Fields Section — always visible (including stories) ── */}
                {(
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
                            const originalDay = post.scheduled_date?.substring(0, 10);
                            console.log(`[PostReviewPanel] Set Date (bulk siblings) — title=${post.title} platform=${post.platform} originalDay=${originalDay} newDate=${date.toISOString()}`);
                            let query = supabase
                              .from("social_posts")
                              .update({ scheduled_date: date.toISOString() })
                              .eq("platform", post.platform)
                              .eq("title", post.title);
                            if (originalDay) {
                              query = query
                                .gte("scheduled_date", `${originalDay}T00:00:00`)
                                .lte("scheduled_date", `${originalDay}T23:59:59`);
                            } else {
                              query = query.eq("id", post.id);
                            }
                            const { error } = await query;
                            if (error) {
                              console.error("[PostReviewPanel] Set Date FAILED:", error.message);
                              toast({ title: "Failed to set date", description: error.message, variant: "destructive" });
                              return;
                            }
                            queryClient.invalidateQueries({ queryKey: ["social_posts"] });
                            setDatePopoverOpen(false);
                            toast({ title: "Date updated", description: `All copies moved to ${format(date, "PPP p")}` });
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
                )}
              </div>

              {/* ── Footer Actions ── */}
              {/* Failed status banner + retry */}
              {(post.status as string) === "failed" && (
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
              {isPublished && (
                <div className="p-4 border-t">
                  <div className="w-full rounded-lg bg-green-600/10 border border-green-600/30 p-3 text-center">
                    <span className="text-sm font-medium text-green-600">Published ✅</span>
                  </div>
                </div>
              )}
              {!isPublished && (
                <div className="p-4 border-t space-y-2">
                  {/* Facebook permission warning */}
                  {fbPublishReady === false && (
                    <div className="w-full rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-center space-y-1">
                      <span className="text-sm font-medium text-amber-700">⚠️ Facebook Permissions Incomplete</span>
                      <p className="text-xs text-amber-600">
                        Missing: {fbMissingScopes.join(", ")}. Publishing may fail. Please reconnect Facebook from Integrations to grant publishing permissions.
                      </p>
                    </div>
                  )}
                  {/* Neel Approval Gate */}
                  {post.neel_approved ? (
                    <Button
                      disabled
                      className="w-full bg-green-50 border border-green-200 text-green-700 hover:bg-green-50 gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Approved by Neel ✅
                    </Button>
                  ) : (currentUserEmail === "neel@rebar.shop" || currentUserEmail === "sattar@rebar.shop") ? (
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
                        <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> Approve Post</>
                      )}
                    </Button>
                  ) : (
                    <Button
                      disabled
                      variant="outline"
                      className="w-full gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Awaiting Approval
                    </Button>
                  )}

                  {/* Publish Now */}
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white gap-1.5"
                    disabled={publishing || post.status === "declined" || (!canPublish && !post.neel_approved)}
                    onClick={async () => {
                      if (localPages.length === 0) {
                        toast({ title: "No pages selected", description: "Please select at least one page.", variant: "destructive" });
                        return;
                      }

                      // Defensive: sync content_type to DB before publish so edge function gets correct value
                      await supabase
                        .from("social_posts")
                        .update({ content_type: localContentType })
                        .eq("id", post.id);

                      // Defensive repair: auto-fix unassigned platform for stories
                      let currentPlatforms = [...localPlatforms];
                      const isAllUnassigned = currentPlatforms.length === 0 || currentPlatforms.every(p => p === "unassigned");
                      if (isAllUnassigned && localContentType === "story") {
                        currentPlatforms = ["instagram"];
                        setLocalPlatforms(currentPlatforms);
                        updatePost.mutate({ id: post.id, platform: "instagram" });
                        console.log("[PostReviewPanel] Auto-repaired unassigned story platform → instagram");
                      }

                      if (currentPlatforms.length === 0) {
                        toast({ title: "No platforms selected", description: "Please select at least one platform.", variant: "destructive" });
                        return;
                      }

                      const publishablePlatforms = currentPlatforms.filter(p => p !== "unassigned");
                      if (publishablePlatforms.length === 0) {
                        toast({ title: "No publishable platform", description: "Please select a valid platform (not 'unassigned').", variant: "destructive" });
                        return;
                      }

                      const combos: { platform: string; page: string }[] = [];
                      for (const plat of publishablePlatforms) {
                        const dbPlat = platformMap[plat] || plat;
                        for (const page of localPages) {
                          combos.push({ platform: dbPlat, page });
                        }
                      }

                      const isUnassigned = post.platform === "unassigned";
                      let allOk = true;

                      // Publish first combo using original post ID
                      const firstCombo = combos[0];
                      const firstOk = await publishPost({
                        id: post.id,
                        platform: firstCombo.platform,
                        content: post.content,
                        title: post.title,
                        hashtags: post.hashtags,
                        image_url: post.image_url,
                        page_name: firstCombo.page,
                        content_type: localContentType,
                        cover_image_url: (post as any).cover_image_url,
                      });
                      if (!firstOk) allOk = false;

                      // For additional combos, clone and publish
                      for (let i = 1; i < combos.length; i++) {
                        const combo = combos[i];
                        // Create a clone for this combo
                        const cloneResult = await createPost.mutateAsync({
                          user_id: post.user_id,
                          platform: combo.platform as any,
                          status: "draft",
                          qa_status: "approved",
                          title: post.title,
                          content: post.content,
                          image_url: post.image_url,
                          hashtags: post.hashtags,
                          page_name: combo.page,
                          content_type: localContentType,
                          scheduled_date: post.scheduled_date,
                        });
                        if (cloneResult?.id) {
                          const ok = await publishPost({
                            id: cloneResult.id,
                            platform: combo.platform,
                            content: post.content,
                            title: post.title,
                            hashtags: post.hashtags,
                            image_url: post.image_url,
                            page_name: combo.page,
                            content_type: localContentType,
                            cover_image_url: (post as any).cover_image_url,
                          });
                          if (!ok) allOk = false;
                        } else {
                          allOk = false;
                        }
                      }

                      // If original was unassigned and first combo changed it, update platform
                      // Then if there were extra combos the original is now the first combo's platform
                      // If unassigned, delete original after cloning (first combo already used original ID)
                      if (isUnassigned && allOk && combos.length > 0) {
                        // The first publishPost already updated the original row's platform,
                        // so it's no longer "unassigned" — no extra delete needed.
                        // But if first combo failed, don't delete.
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

                        if (localContentType !== "story" && (post.content || "").length < 20) {
                          toast({ title: "Content too short", description: "Post content must be at least 20 characters to schedule.", variant: "destructive" });
                          return;
                        }

                        // Build all platform×page combos — filter out "unassigned"
                        const schedulablePlatforms = localPlatforms.filter(p => p !== "unassigned");
                        if (schedulablePlatforms.length === 0) {
                          toast({ title: "No valid platform", description: "Please select a real platform before scheduling.", variant: "destructive" });
                          return;
                        }
                        const combos: { platform: string; page: string }[] = [];
                        for (const plat of schedulablePlatforms) {
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

                        const isUnassigned = post.platform === "unassigned";
                        const allCombos = combos.map(c => ({ platform: c.platform, page: c.page }));
                        console.log(`[PostReviewPanel] Schedule button — post=${postId} platform=${primary.platform} page=${primary.page} date=${post.scheduled_date} unassigned=${isUnassigned}`);
                        const result = await schedulePost({
                          post_id: postId,
                          scheduled_date: post.scheduled_date!,
                          status: "scheduled",
                          qa_status: "scheduled",
                          platform: isUnassigned ? "unassigned" : primary.platform,
                          page_name: isUnassigned ? undefined : primary.page,
                          extra_combos: isUnassigned ? allCombos : (rest.length > 0 ? rest.map(c => ({ platform: c.platform, page: c.page })) : undefined),
                          delete_original: isUnassigned,
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
      <ImageGeneratorDialog
        open={showStoryGen}
        onOpenChange={setShowStoryGen}
        storyMode
        onImageReady={(url) => {
          setShowStoryGen(false);
          setLocalContentType("story");

          // Auto-assign Instagram if platform is unassigned (stories need a publishable platform)
          const needsPlatform = localPlatforms.length === 0 ||
            (localPlatforms.length === 1 && localPlatforms[0] === "unassigned");
          if (needsPlatform) {
            setLocalPlatforms(["instagram"]);
          }

          updatePost.mutate({
            id: post.id,
            content_type: "story",
            content: "",
            title: "",
            hashtags: [],
            ...(needsPlatform ? { platform: "instagram" } : {}),
          });
          handleMediaReady(url, "image");
        }}
      />
      {post?.image_url && !isVideo && (
        <>
          <Dialog open={imageZoomOpen} onOpenChange={setImageZoomOpen}>
            <DialogContent className="max-w-[60vw] max-h-[70vh] p-4 flex items-center justify-center">
              <img src={post.image_url} alt="Full preview" className="max-w-full max-h-[65vh] object-contain rounded-lg" />
            </DialogContent>
          </Dialog>
          <ImageEditDialog
            open={showImageEdit}
            onOpenChange={setShowImageEdit}
            imageUrl={post.image_url}
            onImageReady={(url) => {
              setShowImageEdit(false);
              handleMediaReady(url, "image");
            }}
          />
        </>
      )}
    </>
  );
}
