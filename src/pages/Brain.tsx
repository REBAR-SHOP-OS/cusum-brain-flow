import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, MoreHorizontal, Brain as BrainIcon,
  Image, Video, Globe, FileText, Filter, Play, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AddKnowledgeDialog } from "@/components/brain/AddKnowledgeDialog";
import { KnowledgeDetailDialog } from "@/components/brain/KnowledgeDetailDialog";
import { InteractiveBrainBg } from "@/components/brain/InteractiveBrainBg";

interface KnowledgeItem {
  id: string;
  title: string;
  content: string | null;
  category: string;
  source_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const contentFilters = [
  { id: "all", label: "All", icon: Globe },
  { id: "memory", label: "Memories", icon: BrainIcon },
  { id: "image", label: "Images", icon: Image },
  { id: "video", label: "Videos", icon: Video },
  { id: "webpage", label: "Webpages", icon: Globe },
  { id: "document", label: "Documents", icon: FileText },
];

/* ─── Cards ─── */

function MemoryCard({ item, onClick }: { item: KnowledgeItem; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="rounded-xl bg-card border border-border p-4 hover:border-primary/30 transition-colors cursor-pointer flex flex-col justify-between"
    >
      <div>
        <h3 className="font-semibold text-sm mb-2 line-clamp-1">{item.title}</h3>
        {item.content && (
          <p className="text-xs text-muted-foreground line-clamp-4 mb-3">{item.content}</p>
        )}
      </div>
      <div className="pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground truncate">{item.title}</p>
      </div>
    </div>
  );
}

function ImageCard({ item, onClick }: { item: KnowledgeItem; onClick: () => void }) {
  const thumbnail = item.source_url || (item.metadata as Record<string, string>)?.thumbnail_url;

  return (
    <div
      onClick={onClick}
      className="rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer"
    >
      <div className="aspect-square relative bg-muted">
        {thumbnail ? (
          <img src={thumbnail} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
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

function VideoCard({ item, onClick }: { item: KnowledgeItem; onClick: () => void }) {
  const thumbnail = item.source_url || (item.metadata as Record<string, string>)?.thumbnail_url;

  return (
    <div
      onClick={onClick}
      className="rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer"
    >
      <div className="relative bg-muted aspect-video">
        {thumbnail ? (
          <img src={thumbnail} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
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

function WebpageCard({ item, onClick }: { item: KnowledgeItem; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="rounded-xl bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer"
    >
      <div className="h-32 flex flex-col items-center justify-center gap-2">
        <Globe className="w-8 h-8 text-primary" />
        <span className="text-sm text-muted-foreground">webpage</span>
      </div>
      <div className="p-3 border-t border-border">
        <p className="text-sm truncate">{item.source_url || item.title}</p>
      </div>
    </div>
  );
}

function DocumentCard({ item, onClick }: { item: KnowledgeItem; onClick: () => void }) {
  const fileType =
    (item.metadata as Record<string, string>)?.file_type ||
    item.title.split(".").pop()?.toLowerCase() ||
    "pdf";
  const isPdf = fileType === "pdf";
  const iconColor = isPdf ? "text-orange-500" : "text-blue-500";

  return (
    <div
      onClick={onClick}
      className="rounded-xl bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer"
    >
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

/* ─── Main Page ─── */

export default function Brain() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const queryClient = useQueryClient();

  const { data: knowledge, isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as KnowledgeItem[];
    },
  });

  // Client-side filtering for instant UX
  const filteredItems = useMemo(() => {
    if (!knowledge) return [];
    let items = knowledge;

    // Category filter
    if (activeFilter !== "all") {
      items = items.filter((i) => i.category === activeFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.content?.toLowerCase().includes(q) ||
          i.source_url?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [knowledge, activeFilter, searchQuery]);

  const counts = useMemo(() => {
    if (!knowledge) return {} as Record<string, number>;
    const c: Record<string, number> = { all: knowledge.length };
    for (const item of knowledge) {
      c[item.category] = (c[item.category] || 0) + 1;
    }
    return c;
  }, [knowledge]);

  const refetchKnowledge = () => queryClient.invalidateQueries({ queryKey: ["knowledge"] });

  const renderCard = (item: KnowledgeItem) => {
    const onClick = () => setSelectedItem(item);
    switch (item.category) {
      case "image":
        return <ImageCard key={item.id} item={item} onClick={onClick} />;
      case "video":
        return <VideoCard key={item.id} item={item} onClick={onClick} />;
      case "webpage":
        return <WebpageCard key={item.id} item={item} onClick={onClick} />;
      case "document":
        return <DocumentCard key={item.id} item={item} onClick={onClick} />;
      default:
        return <MemoryCard key={item.id} item={item} onClick={onClick} />;
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Interactive brain background */}
      <InteractiveBrainBg />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border relative z-10">
        <h1 className="text-2xl font-semibold">Brain AI</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-5 h-5" />
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" />
            Add knowledge
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6 relative z-10">
        {/* Banner */}
        {!bannerDismissed && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center flex-shrink-0">
              <BrainIcon className="w-8 h-8 text-primary-foreground" />
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
            <Button className="flex-shrink-0" onClick={() => setBannerDismissed(true)}>
              Ok, got it!
            </Button>
          </div>
        )}

        {/* Filters Row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search toggle */}
          {searchOpen ? (
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-3 py-1.5">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search brain..."
                className="border-0 h-7 bg-transparent p-0 text-sm focus-visible:ring-0 w-40"
              />
              <button
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
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

          <Button variant="outline" size="sm" className="px-2">
            <Filter className="w-4 h-4" />
          </Button>

          {/* Category pills */}
          {contentFilters.map((filter) => (
            <Button
              key={filter.id}
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
              {counts[filter.id] !== undefined && (
                <span className="text-xs opacity-70">({counts[filter.id]})</span>
              )}
            </Button>
          ))}
        </div>

        {/* Content Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-card border border-border overflow-hidden">
                <Skeleton className="w-full h-32" />
                <div className="p-3">
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <BrainIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? "No results found" : `No ${activeFilter === "all" ? "knowledge" : contentFilters.find((f) => f.id === activeFilter)?.label.toLowerCase()} yet`}
            </h3>
            <p className="text-muted-foreground text-sm max-w-md">
              {searchQuery
                ? `No items match "${searchQuery}". Try a different search.`
                : "Add knowledge to help your AI understand you better."}
            </p>
            {!searchQuery && (
              <Button className="mt-4 gap-2" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4" />
                Add knowledge
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredItems.map(renderCard)}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddKnowledgeDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={refetchKnowledge} />
      <KnowledgeDetailDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdated={refetchKnowledge}
      />
    </div>
  );
}
