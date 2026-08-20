import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, MoreHorizontal, Brain as BrainIcon,
  Image, Video, Globe, FileText, Filter, Play, X, Database, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartSearchInput } from "@/components/ui/SmartSearchInput";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AddKnowledgeDialog } from "@/components/brain/AddKnowledgeDialog";
import { ImportDatabaseDialog } from "@/components/brain/ImportDatabaseDialog";
import { KnowledgeDetailDialog } from "@/components/brain/KnowledgeDetailDialog";
import { InteractiveBrainBg } from "@/components/brain/InteractiveBrainBg";
import { useCompanyId } from "@/hooks/useCompanyId";
import { ConfirmActionDialog } from "@/components/accounting/ConfirmActionDialog";
import { toast } from "sonner";

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
      className="rounded-xl bg-card/70 backdrop-blur-sm border border-border/50 p-4 hover:border-primary/30 hover:bg-card/85 transition-all cursor-pointer flex flex-col justify-between"
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
      className="rounded-xl overflow-hidden bg-card/70 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:bg-card/85 transition-all cursor-pointer"
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
      className="rounded-xl overflow-hidden bg-card/70 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:bg-card/85 transition-all cursor-pointer"
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
      className="rounded-xl bg-card/70 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:bg-card/85 transition-all cursor-pointer"
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
      className="rounded-xl bg-card/70 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:bg-card/85 transition-all cursor-pointer"
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
  const [importOpen, setImportOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearAllLoading, setClearAllLoading] = useState(false);
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();

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

  const handleClearAll = async () => {
    if (!companyId) return;
    setClearAllLoading(true);
    try {
      const { error } = await supabase
        .from("knowledge")
        .delete()
        .eq("company_id", companyId);
      if (error) throw error;
      toast.success("All brain items cleared");
      refetchKnowledge();
    } catch {
      toast.error("Failed to clear brain items");
    } finally {
      setClearAllLoading(false);
      setClearAllOpen(false);
    }
  };

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
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border relative z-10 gap-2">
        <h1 className="text-lg sm:text-2xl font-semibold shrink-0">Brain AI</h1>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
            <MoreHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 sm:gap-2 text-xs sm:text-sm text-destructive hover:text-destructive"
            onClick={() => setClearAllOpen(true)}
            disabled={!knowledge?.length}
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Clear All</span>
            <span className="sm:hidden">Clear</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 sm:gap-2 text-xs sm:text-sm" onClick={() => setImportOpen(true)}>
            <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Import DB</span>
            <span className="sm:hidden">Import</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 sm:gap-2 text-xs sm:text-sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Add knowledge</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4 sm:space-y-6 relative z-10">
        {/* Banner */}
        {!bannerDismissed && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center flex-shrink-0">
              <BrainIcon className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base sm:text-lg mb-1">How Brain AI works</h3>
              <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                Think of Brain AI as your digital brain. Add your brand details, links, and files, and it will use them to understand you better.
              </p>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                The richer the info, the smarter and more helpful your AI becomes.
              </p>
            </div>
            <Button size="sm" className="flex-shrink-0 w-full sm:w-auto" onClick={() => setBannerDismissed(true)}>
              Ok, got it!
            </Button>
          </div>
        )}

        {/* Filters Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {/* Search toggle */}
          {searchOpen ? (
            <div className="shrink-0 w-48 sm:w-56">
              <SmartSearchInput
                value={searchQuery}
                onChange={(v) => {
                  setSearchQuery(v);
                  if (!v) { setSearchOpen(false); }
                }}
                placeholder="Search: today, this week..."
                hints={[
                  { category: "Date", suggestions: ["today", "this week", "this month"] },
                  { category: "Category", suggestions: ["memory", "image", "video", "document", "webpage"] },
                ]}
              />
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => setSearchOpen(true)}>
              <Search className="w-4 h-4" />
              Search
            </Button>
          )}

          <Button variant="outline" size="sm" className="px-2 shrink-0">
            <Filter className="w-4 h-4" />
          </Button>

          {/* Category pills */}
          {contentFilters.map((filter) => (
            <Button
              key={filter.id}
              variant={activeFilter === filter.id ? "default" : "outline"}
              size="sm"
              className={cn(
                "gap-1.5 shrink-0",
                activeFilter === filter.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card"
              )}
              onClick={() => setActiveFilter(filter.id)}
            >
              <filter.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{filter.label}</span>
              {counts[filter.id] !== undefined && (
                <span className="text-xs opacity-70">({counts[filter.id]})</span>
              )}
            </Button>
          ))}
        </div>

        {/* Content Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
        ) : activeFilter === "all" && !searchQuery ? (
          <div className="space-y-6">
            {contentFilters
              .filter((f) => f.id !== "all" && (counts[f.id] || 0) > 0)
              .map((section) => {
                const SectionIcon = section.icon;
                const sectionItems = filteredItems.filter(
                  (i) => i.category === section.id
                );
                if (sectionItems.length === 0) return null;
                return (
                  <div key={section.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <SectionIcon className="w-4 h-4 text-primary" />
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        {section.label}
                      </h2>
                      <span className="text-xs text-muted-foreground">({sectionItems.length})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      {sectionItems.map(renderCard)}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredItems.map(renderCard)}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddKnowledgeDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={refetchKnowledge} />
      <ImportDatabaseDialog open={importOpen} onOpenChange={setImportOpen} onSuccess={refetchKnowledge} />
      <KnowledgeDetailDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdated={refetchKnowledge}
      />
      <ConfirmActionDialog
        open={clearAllOpen}
        onOpenChange={setClearAllOpen}
        title="Delete all brain items?"
        description={`This will permanently remove all ${knowledge?.length ?? 0} items. This action cannot be undone.`}
        variant="destructive"
        confirmLabel="Yes, Delete All"
        onConfirm={handleClearAll}
        loading={clearAllLoading}
      />
    </div>
  );
}
