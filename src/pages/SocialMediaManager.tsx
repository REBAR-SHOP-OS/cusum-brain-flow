import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Settings, ChevronLeft, ChevronRight, ThumbsUp, Palette, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addDays, startOfWeek } from "date-fns";
import { PostReviewPanel } from "@/components/social/PostReviewPanel";
import { BrandKitDialog } from "@/components/social/BrandKitDialog";
import { CreateContentDialog } from "@/components/social/CreateContentDialog";
import { SocialCalendar } from "@/components/social/SocialCalendar";
import { SettingsSheet } from "@/components/social/SettingsSheet";

export interface SocialPost {
  id: string;
  platform: "facebook" | "instagram" | "linkedin" | "twitter";
  status: "published" | "scheduled" | "draft";
  title: string;
  content: string;
  imageUrl?: string;
  scheduledDate: Date;
  hashtags: string[];
}

// Mock data for posts
const generateMockPosts = (): SocialPost[] => {
  const posts: SocialPost[] = [];
  const platforms: SocialPost["platform"][] = ["facebook", "instagram", "linkedin", "twitter"];
  const today = new Date();
  const startDate = startOfWeek(today, { weekStartsOn: 1 });
  
  for (let day = 0; day < 7; day++) {
    const date = addDays(startDate, day);
    const numPosts = Math.floor(Math.random() * 4) + 4;
    
    for (let i = 0; i < numPosts; i++) {
      const platform = platforms[Math.floor(Math.random() * platforms.length)];
      const isFuture = date > today;
      
      posts.push({
        id: `post-${day}-${i}`,
        platform,
        status: isFuture ? "scheduled" : "published",
        title: "Custom",
        content: "Prefab rebar. Ready when you are.\n\nNo more waiting on site deliveries. Get top-grade prefab SKUs in stock for same-day pickup and fast project turnaround.\n\nSpeed and reliability start here. Contact us to reserve your order today. 🏗️",
        imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400",
        scheduledDate: date,
        hashtags: ["#RebarShop", "#BuildStrong", "#TorontoConstruction", "#ConstructionMaterials"],
      });
    }
  }
  
  return posts;
};

export default function SocialMediaManager() {
  const navigate = useNavigate();
  const [posts] = useState<SocialPost[]>(generateMockPosts);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [showBrandKit, setShowBrandKit] = useState(false);
  const [showCreateContent, setShowCreateContent] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const postsToReview = posts.filter(p => p.status === "scheduled").length;
  const weekEnd = addDays(weekStart, 6);

  const handlePrevWeek = () => setWeekStart(prev => addDays(prev, -7));
  const handleNextWeek = () => setWeekStart(prev => addDays(prev, 7));

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
          {/* Quick Action Cards */}
          <button
            onClick={() => {
              const firstScheduled = posts.find(p => p.status === "scheduled");
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

          {/* Stats */}
          <div className="flex items-center gap-6 ml-auto">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">112.7K</p>
                <p className="text-xs text-muted-foreground">People reached</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">1.6K</p>
                <p className="text-xs text-muted-foreground">Interactions</p>
              </div>
            </div>
          </div>
        </div>

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

        {/* Calendar Grid */}
        <SocialCalendar
          posts={posts}
          weekStart={weekStart}
          onPostClick={setSelectedPost}
        />
      </div>

      {/* Post Review Panel */}
      <PostReviewPanel
        post={selectedPost}
        postsToReview={postsToReview}
        onClose={() => setSelectedPost(null)}
        onSchedule={() => setSelectedPost(null)}
        onDecline={() => setSelectedPost(null)}
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
