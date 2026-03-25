import { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Settings, ChevronLeft, ChevronRight,
  ThumbsUp, Palette, Users, TrendingUp, Search, Filter, X,
  Sparkles, Loader2, BookOpen, ShieldCheck, CheckSquare, Trash2,
  CalendarDays, PlusSquare, Clock,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmActionDialog } from "@/components/accounting/ConfirmActionDialog";
import { SmartSearchInput } from "@/components/ui/SmartSearchInput";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addDays, startOfWeek, parseISO, isBefore } from "date-fns";
import { cn } from "@/lib/utils";
import { PostReviewPanel } from "@/components/social/PostReviewPanel";
import { BrandKitDialog } from "@/components/social/BrandKitDialog";
import { CreateContentDialog } from "@/components/social/CreateContentDialog";
import { SocialCalendar } from "@/components/social/SocialCalendar";
import { ContentStrategyPanel } from "@/components/social/ContentStrategyPanel";
import { SettingsSheet } from "@/components/social/SettingsSheet";
import { useSocialPosts, type SocialPost } from "@/hooks/useSocialPosts";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { schedulePost } from "@/lib/schedulePost";
import { useAutoGenerate } from "@/hooks/useAutoGenerate";
import { useStrategyChecklist } from "@/hooks/useStrategyChecklist";
import { useSocialApprovals } from "@/hooks/useSocialApprovals";
import { ApprovalsPanel } from "@/components/social/ApprovalsPanel";
import { DeclineReasonDialog } from "@/components/social/DeclineReasonDialog";

const platformFilters = [
  { id: "all", label: "All" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "twitter", label: "X / Twitter" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
];

const statusFilters = [
  { id: "all", label: "All statuses" },
  
  { id: "draft", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
  { id: "declined", label: "Declined" },
];

export default function SocialMediaManager() {
  const navigate = useNavigate();
  const { generatePosts, generating } = useAutoGenerate();
  const { posts, isLoading, updatePost, deletePost, createPost } = useSocialPosts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { completedChecklist, toggleChecklist } = useStrategyChecklist();
  const { pendingApprovals } = useSocialApprovals();
  const [showApprovals, setShowApprovals] = useState(false);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
   const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Derive selectedPost from fresh query data so it updates after mutations
  const selectedPost = useMemo(
    () => (selectedPostId ? posts.find((p) => p.id === selectedPostId) ?? null : null),
    [selectedPostId, posts]
  );

  // Derive groupPages from current posts so it always reflects latest DB state
  const groupPages = useMemo(() => {
    if (!selectedPost) return [];
    const day = selectedPost.scheduled_date?.substring(0, 10);
    const siblings = posts.filter(s =>
      s.title === selectedPost.title &&
      s.platform === selectedPost.platform &&
      (day ? s.scheduled_date?.substring(0, 10) === day : s.id === selectedPost.id)
    );
    return [...new Set(siblings.map(s => s.page_name).filter(Boolean))] as string[];
  }, [selectedPost, posts]);
  const setSelectedPost = useCallback((post: SocialPost | null) => {
    setSelectedPostId(post?.id ?? null);
  }, []);
  const [showBrandKit, setShowBrandKit] = useState(false);
  const [showCreateContent, setShowCreateContent] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Strategy panel
  const [showStrategy, setShowStrategy] = useState(false);
  const [autoGenDate, setAutoGenDate] = useState<Date | undefined>(undefined);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const isProtectedPost = useCallback((id: string) => {
    const post = posts.find((p) => p.id === id);
    return post?.status === "scheduled" || post?.status === "published";
  }, [posts]);

  const toggleSelectPost = useCallback((id: string) => {
    if (isProtectedPost(id)) {
      toast({ title: "پست‌های زمان‌بندی شده و منتشر شده قابل حذف نیستند", variant: "destructive" });
      return;
    }
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [isProtectedPost, toast]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedPostIds(new Set());
  }, []);

  // Filters & search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const weekEnd = addDays(weekStart, 6);

  const filteredPosts = useMemo(() => {
    let items = posts;
    if (platformFilter !== "all") {
      items = items.filter((p) => p.platform === platformFilter);
    }
    if (statusFilter === "approved_by_neel") {
      items = items.filter((p) => p.neel_approved);
    } else if (statusFilter === "pending_approval") {
      items = items.filter(
        (p) => !p.neel_approved
          && p.status !== "published"
          && p.status !== "declined"
      );
    } else if (statusFilter !== "all") {
      // Always keep scheduled + published visible, plus the selected status
      items = items.filter(
        (p) => p.status === statusFilter || p.status === "scheduled" || p.status === "published"
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (p) =>
          // Never hide scheduled/published posts even if they don't match search
          p.status === "scheduled" || p.status === "published" ||
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.hashtags.some((h) => h.toLowerCase().includes(q))
      );
    }
    if (statusFilter === "pending_approval") {
      items = [...items].sort((a, b) => {
        const da = a.scheduled_date ? new Date(a.scheduled_date).getTime() : Infinity;
        const db = b.scheduled_date ? new Date(b.scheduled_date).getTime() : Infinity;
        return da - db;
      });
    }
    return items;
  }, [posts, platformFilter, statusFilter, searchQuery]);

  const toggleSelectAll = useCallback(() => {
    const selectableIds = filteredPosts.filter((p) => p.status !== "scheduled" && p.status !== "published").map((p) => p.id);
    if (selectableIds.length > 0 && selectableIds.every((id) => selectedPostIds.has(id))) {
      setSelectedPostIds(new Set());
    } else {
      setSelectedPostIds(new Set(selectableIds));
    }
  }, [filteredPosts, selectedPostIds]);

  const handleSelectDay = useCallback((dayPostIds: string[]) => {
    const safeIds = dayPostIds.filter((id) => !isProtectedPost(id));
    setSelectedPostIds((prev) => {
      const allSelected = safeIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        for (const id of safeIds) next.delete(id);
      } else {
        for (const id of safeIds) next.add(id);
      }
      return next;
    });
  }, [isProtectedPost]);

  const handleBulkDelete = useCallback(async () => {
    setBulkDeleting(true);

    // Filter out protected posts as a safety net
    const deletableIds = [...selectedPostIds].filter((id) => !isProtectedPost(id));

    for (const id of deletableIds) {
      await deletePost.mutateAsync(id);
    }

    setBulkDeleting(false);
    setShowDeleteConfirm(false);
    exitSelectionMode();
  }, [selectedPostIds, deletePost, exitSelectionMode, isProtectedPost]);

  const weekPosts = useMemo(() => {
    const wEnd = addDays(weekStart, 7);
    return filteredPosts.filter((p) => {
      if (!p.scheduled_date) return false;
      const d = parseISO(p.scheduled_date);
      return d >= weekStart && d < wEnd;
    });
  }, [filteredPosts, weekStart]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: weekPosts.length };
    for (const p of weekPosts) {
      c[p.platform] = (c[p.platform] || 0) + 1;
    }
    return c;
  }, [weekPosts]);

  const jumpToLatestPost = useCallback(() => {
    const sorted = [...filteredPosts]
      .filter((p) => p.scheduled_date)
      .sort((a, b) => new Date(b.scheduled_date!).getTime() - new Date(a.scheduled_date!).getTime());
    if (sorted.length > 0) {
      const latestDate = parseISO(sorted[0].scheduled_date!);
      setWeekStart(startOfWeek(latestDate, { weekStartsOn: 1 }));
    }
  }, [filteredPosts]);

  const approvedCount = posts.filter((p) => p.neel_approved).length;
  const postsToReview = approvedCount;

  const handlePrevWeek = () => setWeekStart((prev) => addDays(prev, -7));
  const handleNextWeek = () => setWeekStart((prev) => addDays(prev, 7));

  const handleSchedule = async (post: SocialPost) => {
    if (post.platform === "unassigned") {
      // Use schedulePost with delete_original to clone into platform-specific posts and remove unassigned card
      const result = await schedulePost({
        post_id: post.id,
        scheduled_date: post.scheduled_date || new Date().toISOString(),
        qa_status: "scheduled",
        status: "scheduled",
        platform: post.platform,
        page_name: post.page_name,
        delete_original: true,
        title: post.title,
        extra_combos: post.page_name ? [{ platform: post.platform, page: post.page_name }] : [],
      });
      if (!result.success) {
        console.error("[handleSchedule] schedulePost failed for unassigned:", result.error);
      }
      queryClient.invalidateQueries({ queryKey: ["social_posts"] });
    } else {
      updatePost.mutate({ id: post.id, qa_status: "approved", status: "scheduled" });
    }
    setSelectedPost(null);
  };

  const [declineTarget, setDeclineTarget] = useState<SocialPost | null>(null);

  const handleDecline = async (post: SocialPost, reason?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const declinedBy = user?.email || "unknown";
    updatePost.mutate({ id: post.id, status: "declined", neel_approved: false, declined_by: declinedBy, decline_reason: reason || null } as any);
    setSelectedPost(null);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border gap-2 sm:gap-0 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/integrations")}>
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <h1 className="text-base sm:text-xl font-semibold">Social Media</h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-0">
            <Button
              onClick={() => generatePosts({ scheduledDate: autoGenDate?.toISOString() })}
              disabled={generating}
              variant="outline"
              size="sm"
              className="gap-1.5 flex-1 sm:flex-initial rounded-r-none"
            >
              {generating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {generating ? "Generating..." : autoGenDate ? `Auto-generate ${format(autoGenDate, "MMM d")}` : "Auto-generate today"}
              </span>
              <span className="sm:hidden">{generating ? "..." : "Auto"}</span>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="px-2 rounded-l-none border-l-0">
                  <CalendarDays className="w-3.5 h-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={autoGenDate}
                  onSelect={(d) => setAutoGenDate(d)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <Button
            variant={showApprovals ? "default" : "outline"}
            size="sm"
            className="gap-1.5 relative"
            onClick={() => { setShowApprovals((v) => { const next = !v; if (next) setStatusFilter("approved_by_neel"); else setStatusFilter("all"); return next; }); setShowStrategy(false); }}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Approvals</span>
            {pendingApprovals.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pendingApprovals.length}
              </span>
            )}
          </Button>
          <Button
            variant={statusFilter === "pending_approval" ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setStatusFilter(statusFilter === "pending_approval" ? "all" : "pending_approval")}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pending Approval</span>
          </Button>
          <Button
            variant={showStrategy ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => { setShowStrategy((v) => !v); setShowApprovals(false); }}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Strategy</span>
          </Button>
          <Button onClick={() => setShowCreateContent(true)} size="sm" className="bg-primary hover:bg-primary/90 gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Create content</span>
            <span className="sm:hidden">Create</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettings(true)}>
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Quick Actions & Stats */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => {
              setStatusFilter("approved_by_neel");
              setPlatformFilter("all");
              setSearchQuery("");
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-500 text-white hover:opacity-90 transition-opacity"
          >
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span className="font-medium">{approvedCount} Approved posts</span>
            <ArrowLeft className="w-4 h-4 rotate-[135deg]" />
          </button>

          <button
            onClick={() => setShowBrandKit(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-violet-600 to-violet-500 text-white hover:opacity-90 transition-opacity"
          >
            <Palette className="w-5 h-5 shrink-0" />
            <span className="font-medium">Edit your Brand Kit</span>
            <ArrowLeft className="w-4 h-4 rotate-[135deg]" />
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-sky-600 to-sky-500 text-white hover:opacity-90 transition-opacity">
                <PlusSquare className="w-5 h-5 shrink-0" />
                <span className="font-medium">Add Card</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={(date) => {
                  if (!date) return;
                  const user = posts[0]?.user_id;
                  if (!user) return;
                  const scheduled = format(date, "yyyy-MM-dd'T'10:00:00");
                  createPost.mutate(
                    { platform: "unassigned", status: "draft", qa_status: "needs_review", title: "", content: "", scheduled_date: scheduled, user_id: user, hashtags: [], neel_approved: false },
                    { onSuccess: (newPost) => {
                        setWeekStart(startOfWeek(date, { weekStartsOn: 1 }));
                        if (newPost?.id) setSelectedPostId(newPost.id);
                      },
                    }
                  );
                }}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-4 sm:gap-6 sm:ml-auto">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              <div>
                <p className="text-xl sm:text-2xl font-bold">{posts.filter((p) => p.status === "published").length}</p>
                <p className="text-xs text-muted-foreground">Published</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              <div>
                <p className="text-xl sm:text-2xl font-bold">{posts.filter((p) => p.status === "scheduled" || p.status === "published").length}</p>
                <p className="text-xs text-muted-foreground">Total posts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search, Filters & Selection */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-thin mb-4">
          {/* Selection mode toggle */}
          <Button
            variant={selectionMode ? "default" : "outline"}
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
          >
            <CheckSquare className="w-4 h-4" />
            <span className="hidden sm:inline">{selectionMode ? "Cancel" : "Select"}</span>
          </Button>

          {selectionMode && (
            <>
              {selectedPostIds.size > 0 && (
                <>
                  <span className="text-xs font-medium text-foreground shrink-0">
                    {selectedPostIds.size} selected
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                </>
              )}
              <div className="w-px h-6 bg-border mx-0.5 shrink-0" />
            </>
          )}

          {searchOpen ? (
            <div className="shrink-0 w-40 sm:w-52">
              <SmartSearchInput
                value={searchQuery}
                onChange={(v) => {
                  setSearchQuery(v);
                  if (!v) { setSearchOpen(false); }
                }}
                placeholder="Search: draft, scheduled, today..."
                hints={[
                  { category: "Date", suggestions: ["today", "this week", "this month"] },
                  { category: "Status", suggestions: ["draft", "scheduled", "published"] },
                  { category: "Platform", suggestions: ["facebook", "instagram", "linkedin", "tiktok"] },
                ]}
              />
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => setSearchOpen(true)}>
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </Button>
          )}

          {/* Status filter pills */}
          {statusFilters.map((f) => (
            <Button
              key={f.id}
              variant={statusFilter === f.id ? "default" : "outline"}
              size="sm"
              className={cn(
                "shrink-0",
                statusFilter === f.id ? "bg-primary text-primary-foreground" : "bg-card"
              )}
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}

          {/* Platform pills */}
          <div className="w-px h-6 bg-border mx-0.5 shrink-0" />
          {platformFilters.map((f) => (
            <Button
              key={f.id}
              variant={platformFilter === f.id ? "default" : "outline"}
              size="sm"
              className={cn(
                "shrink-0",
                platformFilter === f.id ? "bg-primary text-primary-foreground" : "bg-card"
              )}
              onClick={() => setPlatformFilter(f.id)}
            >
              {f.label}
              {counts[f.id] !== undefined && (
                <span className="text-xs opacity-70 ml-1">({counts[f.id]})</span>
              )}
            </Button>
          ))}
        </div>

        {/* Content Strategy Panel */}
        {/* Approvals Panel */}
        {showApprovals && (
          <div className="mb-6">
            <ApprovalsPanel />
          </div>
        )}

        {/* Content Strategy Panel */}
        {showStrategy && (
          <div className="mb-6">
            <ContentStrategyPanel
              completedChecklist={completedChecklist}
              onToggleChecklist={toggleChecklist}
              posts={posts}
            />
          </div>
        )}

        {/* Date Navigation */}
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={handlePrevWeek}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="font-medium">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}
          </span>
          <Button variant="ghost" size="icon" onClick={handleNextWeek}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Calendar Grid, Pending List, or Loading */}
        {isLoading ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="min-h-[400px]">
                <Skeleton className="h-8 w-full mb-2 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 && !searchQuery && platformFilter === "all" && statusFilter === "all" ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Let Pixel handle it</h3>
            <p className="text-muted-foreground text-sm max-w-md">
              Click "Auto-generate today" and Pixel will create posts for all your connected platforms. You just approve!
            </p>
            <div className="flex gap-3 mt-4">
              <div className="flex items-center gap-0">
                <Button
                  className="gap-2 rounded-r-none"
                  onClick={() => generatePosts({ scheduledDate: autoGenDate?.toISOString() })}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {generating ? "Generating..." : autoGenDate ? `Auto-generate ${format(autoGenDate, "MMM d")}` : "Auto-generate today"}
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" className="px-2 rounded-l-none border-l border-primary-foreground/20">
                      <CalendarDays className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={autoGenDate}
                      onSelect={(d) => setAutoGenDate(d)}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button variant="outline" className="gap-2" onClick={() => setShowCreateContent(true)}>
                <Plus className="w-4 h-4" />
                Create manually
              </Button>
            </div>
          </div>
        ) : (
          <>
            <SocialCalendar
               posts={filteredPosts}
               weekStart={weekStart}
               onPostClick={(p) => {
                 setSelectedPost(p);
               }}
               onGroupClick={(post, pages) => { setSelectedPost(post); }}
               selectedPostIds={selectionMode ? selectedPostIds : undefined}
               onToggleSelect={selectionMode ? toggleSelectPost : undefined}
               onSelectDay={selectionMode ? handleSelectDay : undefined}
             />
            {weekPosts.length === 0 && filteredPosts.length > 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <p className="text-sm mb-2">No posts scheduled this week</p>
                <Button variant="outline" size="sm" onClick={jumpToLatestPost}>
                  Jump to latest post
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Post Review Panel */}
      <PostReviewPanel
        post={selectedPost}
        groupPages={groupPages}
        postsToReview={postsToReview}
        onClose={() => { setSelectedPost(null); }}
        onSchedule={() => selectedPost && handleSchedule(selectedPost)}
        onDecline={() => selectedPost && setDeclineTarget(selectedPost)}
      />

      {/* Brand Kit Dialog */}
      <BrandKitDialog open={showBrandKit} onOpenChange={setShowBrandKit} />

      {/* Create Content Dialog */}
      <CreateContentDialog open={showCreateContent} onOpenChange={setShowCreateContent} />

      {/* Settings Sheet */}
      <SettingsSheet open={showSettings} onOpenChange={setShowSettings} />

      {/* Bulk Delete Confirmation */}
      <ConfirmActionDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete selected posts?"
        description={`This will permanently delete ${selectedPostIds.size} post(s) from the database.`}
        variant="destructive"
        confirmLabel="Delete all"
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
      />

      {/* Decline Reason Dialog */}
      <DeclineReasonDialog
        open={!!declineTarget}
        onOpenChange={(open) => { if (!open) setDeclineTarget(null); }}
        onConfirm={(reason) => {
          if (declineTarget) handleDecline(declineTarget, reason);
          setDeclineTarget(null);
        }}
      />
    </div>
  );
}
