import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, Plus, MoreHorizontal, Brain as BrainIcon, 
  Image, Video, Globe, FileText, Filter, Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ContentFilter {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface KnowledgeItem {
  id: string;
  title: string;
  content: string | null;
  category: string;
  source_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const contentFilters: ContentFilter[] = [
  { id: "search", label: "Search", icon: Search },
  { id: "all", label: "All", icon: Globe },
  { id: "memory", label: "Memories", icon: BrainIcon },
  { id: "image", label: "Images", icon: Image },
  { id: "video", label: "Videos", icon: Video },
  { id: "webpage", label: "Webpages", icon: Globe },
  { id: "document", label: "Documents", icon: FileText },
];

function MemoryCard({ item }: { item: KnowledgeItem }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 hover:border-primary/30 transition-colors cursor-pointer">
      <h3 className="font-semibold text-sm mb-2">{item.title}</h3>
      {item.content && (
        <p className="text-xs text-muted-foreground line-clamp-6 mb-4">
          {item.content}
        </p>
      )}
      <div className="pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground truncate">{item.title}</p>
      </div>
    </div>
  );
}

function ImageCard({ item }: { item: KnowledgeItem }) {
  const thumbnail = item.source_url || (item.metadata as Record<string, string>)?.thumbnail_url;
  
  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer">
      <div className="aspect-square relative bg-muted">
        {thumbnail ? (
          <img 
            src={thumbnail} 
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-12 h-12 text-muted-foreground/50" />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium truncate">{item.title}</p>
      </div>
    </div>
  );
}

function VideoCard({ item }: { item: KnowledgeItem }) {
  const thumbnail = item.source_url || (item.metadata as Record<string, string>)?.thumbnail_url;
  
  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer">
      <div className="relative bg-muted aspect-video">
        {thumbnail ? (
          <img 
            src={thumbnail} 
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="w-12 h-12 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white ml-1" />
          </div>
        </div>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium truncate">{item.title}</p>
      </div>
    </div>
  );
}

function WebpageCard({ item }: { item: KnowledgeItem }) {
  return (
    <div className="rounded-xl bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer">
      <div className="h-32 flex flex-col items-center justify-center gap-2">
        <Globe className="w-8 h-8 text-purple-500" />
        <span className="text-sm text-muted-foreground">webpage</span>
      </div>
      <div className="p-3 border-t border-border">
        <p className="text-sm truncate">{item.source_url || item.title}</p>
      </div>
    </div>
  );
}

function DocumentCard({ item }: { item: KnowledgeItem }) {
  const fileType = (item.metadata as Record<string, string>)?.file_type || 
    item.title.split('.').pop()?.toLowerCase() || 'pdf';
  const isPdf = fileType === 'pdf';
  const iconColor = isPdf ? "text-orange-500" : "text-blue-500";
  
  return (
    <div className="rounded-xl bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer">
      <div className="h-32 flex flex-col items-center justify-center gap-2">
        <FileText className={cn("w-8 h-8", iconColor)} />
        <span className="text-sm text-muted-foreground">{fileType}</span>
      </div>
      <div className="p-3 border-t border-border">
        <p className="text-sm truncate">{item.title}</p>
      </div>
    </div>
  );
}

function LoadingGrid({ type }: { type: string }) {
  const count = type === "video" ? 4 : 8;
  return (
    <div className={cn(
      "grid gap-4",
      type === "video" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
    )}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl bg-card border border-border overflow-hidden">
          <Skeleton className={cn("w-full", type === "image" ? "aspect-square" : "h-32")} />
          <div className="p-3">
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ filter }: { filter: string }) {
  const filterLabel = contentFilters.find(f => f.id === filter)?.label || "items";
  
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <BrainIcon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">No {filterLabel.toLowerCase()} yet</h3>
      <p className="text-muted-foreground text-sm max-w-md">
        Add knowledge to help your AI understand you better. Upload documents, save webpages, or add memories.
      </p>
      <Button className="mt-4 gap-2">
        <Plus className="w-4 h-4" />
        Add knowledge
      </Button>
    </div>
  );
}

export default function Brain() {
  const [activeFilter, setActiveFilter] = useState("all");

  const { data: knowledge, isLoading } = useQuery({
    queryKey: ['knowledge', activeFilter],
    queryFn: async () => {
      let query = supabase
        .from('knowledge')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (activeFilter !== 'all' && activeFilter !== 'search') {
        query = query.eq('category', activeFilter);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as KnowledgeItem[];
    },
  });

  const renderContent = () => {
    if (isLoading) {
      return <LoadingGrid type={activeFilter} />;
    }

    if (!knowledge || knowledge.length === 0) {
      return <EmptyState filter={activeFilter} />;
    }

    // Group by category for 'all' view or render by active filter
    const renderByCategory = (items: KnowledgeItem[], category: string) => {
      switch (category) {
        case "memory":
          return items.map((item) => <MemoryCard key={item.id} item={item} />);
        case "image":
          return items.map((item) => <ImageCard key={item.id} item={item} />);
        case "video":
          return items.map((item) => (
            <div key={item.id} className="break-inside-avoid">
              <VideoCard item={item} />
            </div>
          ));
        case "webpage":
          return items.map((item) => <WebpageCard key={item.id} item={item} />);
        case "document":
          return items.map((item) => <DocumentCard key={item.id} item={item} />);
        default:
          return items.map((item) => <MemoryCard key={item.id} item={item} />);
      }
    };

    if (activeFilter === "all" || activeFilter === "search") {
      // Show all as memory cards for the "all" view
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {knowledge.map((item) => {
            switch (item.category) {
              case "image":
                return <ImageCard key={item.id} item={item} />;
              case "video":
                return <VideoCard key={item.id} item={item} />;
              case "webpage":
                return <WebpageCard key={item.id} item={item} />;
              case "document":
                return <DocumentCard key={item.id} item={item} />;
              default:
                return <MemoryCard key={item.id} item={item} />;
            }
          })}
        </div>
      );
    }

    // Specific category views with appropriate layouts
    if (activeFilter === "video") {
      return (
        <div className="columns-1 md:columns-2 lg:columns-4 gap-4 space-y-4">
          {renderByCategory(knowledge, activeFilter)}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderByCategory(knowledge, activeFilter)}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h1 className="text-2xl font-semibold">Brain AI</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-5 h-5" />
          </Button>
          <Button variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            Add knowledge
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* How Brain AI Works Banner */}
        <div className="bg-[hsl(var(--success)/0.1)] border border-[hsl(var(--success)/0.3)] rounded-xl p-6 flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
            <BrainIcon className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">How Brain AI works</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Think of Brain AI as your digital brain. Add your brand details, links, and files, and it will use them to understand you better.
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              The richer the info, the smarter and more helpful your AI becomes.
            </p>
          </div>
          <Button className="bg-primary hover:bg-primary/90 flex-shrink-0">
            Ok, got it!
          </Button>
        </div>

        {/* Content Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {contentFilters.map((filter, index) => (
            <div key={filter.id} className="contents">
              <Button
                variant={activeFilter === filter.id ? "default" : "outline"}
                size="sm"
                className={cn(
                  "gap-2",
                  activeFilter === filter.id 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-card"
                )}
                onClick={() => setActiveFilter(filter.id)}
              >
                <filter.icon className="w-4 h-4" />
                {filter.label}
              </Button>
              {index === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card px-2"
                >
                  <Filter className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Content Grid */}
        {renderContent()}
      </div>
    </div>
  );
}
