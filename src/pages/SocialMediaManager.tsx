import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Settings, ChevronLeft, ChevronRight,
  ThumbsUp, Palette, Users, TrendingUp, Search, Filter, X,
  Sparkles, Loader2, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addDays, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { PostReviewPanel } from "@/components/social/PostReviewPanel";
import { BrandKitDialog } from "@/components/social/BrandKitDialog";
import { CreateContentDialog } from "@/components/social/CreateContentDialog";
import { SocialCalendar } from "@/components/social/SocialCalendar";
import { ContentStrategyPanel } from "@/components/social/ContentStrategyPanel";
import { SettingsSheet } from "@/components/social/SettingsSheet";
import { useSocialPosts, type SocialPost } from "@/hooks/useSocialPosts";
import { useAutoGenerate } from "@/hooks/useAutoGenerate";

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
  const { posts, isLoading, updatePost } = useSocialPosts();

  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [showBrandKit, setShowBrandKit] = useState(false);
  const [showCreateContent, setShowCreateContent] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Strategy panel
  const [showStrategy, setShowStrategy] = useState(false);
  const [completedChecklist, setCompletedChecklist] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("social_checklist") || "[]");
    } catch { return []; }
  });

  const toggleChecklist = useCallback((id: string) => {
    setCompletedChecklist((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      localStorage.setItem("social_checklist", JSON.stringify(next));
      return next;
    });
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
    if (statusFilter !== "all") {
      items = items.filter((p) => p.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.hashtags.some((h) => h.toLowerCase().includes(q))
      );
    }
    return items;
  }, [posts, platformFilter, statusFilter, searchQuery]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: posts.length };
    for (const p of posts) {
      c[p.platform] = (c[p.platform] || 0) + 1;
    }
    return c;
  }, [posts]);

  const postsToReview = posts.filter((p) => p.status === "scheduled").length;

  const handlePrevWeek = () => setWeekStart((prev) => addDays(prev, -7));
  const handleNextWeek = () => setWeekStart((prev) => addDays(prev, 7));

  const handleSchedule = (post: SocialPost) => {
    updatePost.mutate({ id: post.id, status: "scheduled" });
    setSelectedPost(null);
  };

  const handleDecline = (post: SocialPost) => {
    updatePost.mutate({ id: post.id, status: "declined" });
    setSelectedPost(null);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/integrations")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">Social Media Manager</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => generatePosts()}
            disabled={generating}
            variant="outline"
            className="gap-2"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generating ? "Generating..." : "Auto-generate today"}
          </Button>
          <Button
            variant={showStrategy ? "default" : "outline"}
            className="gap-2"
            onClick={() => setShowStrategy((v) => !v)}
          >
            <BookOpen className="w-4 h-4" />
            Strategy
          </Button>
          <Button onClick={() => setShowCreateContent(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Create content
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Quick Actions & Stats */}
        <div className="flex flex-wrap gap-4 mb-6">
          <button
            onClick={() => {
              const firstScheduled = posts.find((p) => p.status === "scheduled");
              if (firstScheduled) setSelectedPost(firstScheduled);
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-purple-600 to-purple-500 text-white hover:opacity-90 transition-opacity"
          >
            <ThumbsUp className="w-5 h-5" />
            <span className="font-medium">{postsToReview} posts to review</span>
            <ArrowLeft className="w-4 h-4 rotate-[135deg]" />
          </button>

          <button
            onClick={() => setShowBrandKit(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-violet-600 to-violet-500 text-white hover:opacity-90 transition-opacity"
          >
            <Palette className="w-5 h-5" />
            <span className="font-medium">Edit your Brand Kit</span>
            <ArrowLeft className="w-4 h-4 rotate-[135deg]" />
          </button>

          <div className="flex items-center gap-6 ml-auto">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{posts.filter((p) => p.status === "published").length}</p>
                <p className="text-xs text-muted-foreground">Published</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{posts.length}</p>
                <p className="text-xs text-muted-foreground">Total posts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {searchOpen ? (
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-3 py-1.5">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search posts..."
                className="border-0 h-7 bg-transparent p-0 text-sm focus-visible:ring-0 w-40"
              />
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                className="p-0.5 rounded hover:bg-muted"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setSearchOpen(true)}>
              <Search className="w-4 h-4" />
              Search
            </Button>
          )}

          {/* Status filter dropdown-like pills */}
          {statusFilters.map((f) => (
            <Button
              key={f.id}
              variant={statusFilter === f.id ? "default" : "outline"}
              size="sm"
              className={cn(
                statusFilter === f.id ? "bg-primary text-primary-foreground" : "bg-card"
              )}
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}

          {/* Platform pills */}
          <div className="w-px h-6 bg-border mx-1" />
          {platformFilters.map((f) => (
            <Button
              key={f.id}
              variant={platformFilter === f.id ? "default" : "outline"}
              size="sm"
              className={cn(
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
        {showStrategy && (
          <div className="mb-6">
            <ContentStrategyPanel
              completedChecklist={completedChecklist}
              onToggleChecklist={toggleChecklist}
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

        {/* Calendar Grid or Loading */}
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
              <Button
                className="gap-2"
                onClick={() => generatePosts()}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {generating ? "Generating..." : "Auto-generate today"}
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setShowCreateContent(true)}>
                <Plus className="w-4 h-4" />
                Create manually
              </Button>
            </div>
          </div>
        ) : (
          <SocialCalendar
            posts={filteredPosts}
            weekStart={weekStart}
            onPostClick={setSelectedPost}
          />
        )}
      </div>

      {/* Post Review Panel */}
      <PostReviewPanel
        post={selectedPost}
        postsToReview={postsToReview}
        onClose={() => setSelectedPost(null)}
        onSchedule={() => selectedPost && handleSchedule(selectedPost)}
        onDecline={() => selectedPost && handleDecline(selectedPost)}
      />

      {/* Brand Kit Dialog */}
      <BrandKitDialog open={showBrandKit} onOpenChange={setShowBrandKit} />

      {/* Create Content Dialog */}
      <CreateContentDialog open={showCreateContent} onOpenChange={setShowCreateContent} />

      {/* Settings Sheet */}
      <SettingsSheet open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
