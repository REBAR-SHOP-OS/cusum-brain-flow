import { useState } from "react";
import { 
  Search, Plus, MoreHorizontal, Brain as BrainIcon, 
  Image, Video, Globe, FileText, Filter, Play
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ContentFilter {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface KnowledgeItem {
  id: string;
  title: string;
  description?: string;
  type: "memory" | "image" | "video" | "webpage" | "document";
  thumbnail?: string;
  url?: string;
  fileType?: string;
}

const contentFilters: ContentFilter[] = [
  { id: "search", label: "Search", icon: Search },
  { id: "all", label: "All", icon: Globe },
  { id: "memories", label: "Memories", icon: BrainIcon },
  { id: "images", label: "Images", icon: Image },
  { id: "videos", label: "Videos", icon: Video },
  { id: "webpages", label: "Webpages", icon: Globe },
  { id: "documents", label: "Documents", icon: FileText },
];

// Mock data for different content types
const mockMemories: KnowledgeItem[] = [
  { id: "m1", title: "Language Preference", description: "Bilingual (Persian/Farsi and English); uses Persian for detailed technical instructions and English for responses", type: "memory" },
  { id: "m2", title: "2025 HST & ITC Summary and Critical Gaps", description: "For 2025, I owe CRA $121,434 in HST (up from $33,480 in 2024) due to revenue increasing 185% ($1.01M to $2.87M) and HST liability rising 263%. ITC eligibility also rose 159% ($97,281 to $251,764). Key issues: 1) Consulting ($78,479): Ensure all vendors are HST-registered or risk $10,202 in unrecoverable ITC. 2) Meals ($10,249): Only 50% ITC recoverable; miscoding may overstate ITC by $666. 3) Rent ($146,425): Should be 100% recoverable with 13% HST ($19,035 ITC). 4) Bank Fees...", type: "memory" },
  { id: "m3", title: "2025 HST & ITC Position and Action Steps", description: "For 2025, HST owed to CRA is $121,434 (up 263% from $33,480 in 2024), driven by a 185% revenue increase ($1.01M to $2.87M). ITC eligibility rose 159% ($97,281 to $251,764). Key issues: 1) Consulting ($78,479): Confirm all vendors are HST-registered or risk $10,202 in unrecoverable ITC; 2) Meals ($10,249): Only 50% is recoverable, potential $666 ITC overstatement; 3) Rent ($146,425): ensure HST 13% coding to claim $19,035 ITC; 4) Bank Fees...", type: "memory" },
  { id: "m4", title: "Social Media Audit & Action Plan", description: "Current strengths: posting 3-4x daily across multiple platforms (Facebook, Instagram, LinkedIn), professional branded captions, consistent use of relevant hashtags. Critical issues: content is generic/repetitive (mostly inspirational, product showcase, off-brand wellness, vague social proof), lacks engagement strategy and strong CTAs, uses only generic AI-generated images (no real product/facility/team visuals), fails to highlight competitive advantages (same-day delivery, AI automation), content lacks...", type: "memory" },
  { id: "m5", title: "Content Format Preference", description: "Reels/video content outperforms static posts on Instagram - best performing content is short-form video", type: "memory" },
  { id: "m6", title: "Target Customers", description: "Target Customers: Contractors, builders, engineers, procurement managers, project managers,", type: "memory" },
  { id: "m7", title: "Current Social Media Presence", description: "Multiple accounts across Instagram (@rebar.shop,", type: "memory" },
  { id: "m8", title: "Rebar Shop Customer Source Analysis & Recommendations (Last 90 Days)", description: "", type: "memory" },
  { id: "m9", title: "Communication Style", description: "Prefers brevity and directness; wants to test quality/capabilities quickly with minimal back-and-forth; communication style is", type: "memory" },
];

const mockImages: KnowledgeItem[] = [
  { id: "i1", title: "Construction Morning Motivation...", type: "image", thumbnail: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=300&h=300&fit=crop" },
  { id: "i2", title: "Rebar.shop Logo", type: "image", thumbnail: "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=300&h=300&fit=crop" },
  { id: "i3", title: "Perfect Rebar Detailing Shop Dr...", type: "image", thumbnail: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=300&h=300&fit=crop" },
  { id: "i4", title: "Basant Panchami 2026 Celebra...", type: "image", thumbnail: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=300&h=300&fit=crop" },
  { id: "i5", title: "Basant Panchami Festival 2025", type: "image", thumbnail: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=300&h=300&fit=crop" },
  { id: "i6", title: "Basant Panchami Celebration", type: "image", thumbnail: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=300&h=300&fit=crop" },
  { id: "i7", title: "Rebar.Shop Facility Header", type: "image", thumbnail: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=300&h=200&fit=crop" },
  { id: "i8", title: "Urban Construction - Building ...", type: "image", thumbnail: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=300&h=300&fit=crop" },
];

const mockVideos: KnowledgeItem[] = [
  { id: "v1", title: "Strong Rebar Solid Foundations ...", type: "video", thumbnail: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop" },
  { id: "v2", title: "IMG_1392.mov", type: "video", thumbnail: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&h=500&fit=crop" },
  { id: "v3", title: "IMG_1219.mov", type: "video", thumbnail: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=250&fit=crop" },
  { id: "v4", title: "IMG_9250.MP4", type: "video", thumbnail: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&h=500&fit=crop" },
];

const mockWebpages: KnowledgeItem[] = [
  { id: "w1", title: "webpage", type: "webpage", url: "https://laws-lois.justice.gc.ca/e..." },
  { id: "w2", title: "webpage", type: "webpage", url: "https://www.ontario.ca/laws/st..." },
  { id: "w3", title: "webpage", type: "webpage", url: "https://laws-lois.justice.gc.ca/e..." },
  { id: "w4", title: "webpage", type: "webpage", url: "https://www.cpaontario.ca/prot..." },
  { id: "w5", title: "webpage", type: "webpage", url: "https://www.rebar.shop/" },
];

const mockDocuments: KnowledgeItem[] = [
  { id: "d1", title: "Document (7).pdf", type: "document", fileType: "pdf" },
  { id: "d2", title: "L2B_Guide_to_Construction_A...", type: "document", fileType: "pdf" },
  { id: "d3", title: "PPO - Trade Contractors Guide ...", type: "document", fileType: "pdf" },
  { id: "d4", title: "C-44.pdf", type: "document", fileType: "pdf" },
  { id: "d5", title: "RebarShop_Nucor_Playbook.docx", type: "document", fileType: "docx" },
  { id: "d6", title: "Rebar_shop_30_Year_Strategic...", type: "document", fileType: "pdf" },
  { id: "d7", title: "Manual-Standard-Practice-201...", type: "document", fileType: "pdf" },
];

function MemoryCard({ item }: { item: KnowledgeItem }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 hover:border-primary/30 transition-colors cursor-pointer">
      <h3 className="font-semibold text-sm mb-2">{item.title}</h3>
      {item.description && (
        <p className="text-xs text-muted-foreground line-clamp-6 mb-4">
          {item.description}
        </p>
      )}
      <div className="pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground truncate">{item.title}</p>
      </div>
    </div>
  );
}

function ImageCard({ item }: { item: KnowledgeItem }) {
  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer">
      <div className="aspect-square relative">
        <img 
          src={item.thumbnail} 
          alt={item.title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-3">
        <p className="text-sm font-medium truncate">{item.title}</p>
      </div>
    </div>
  );
}

function VideoCard({ item }: { item: KnowledgeItem }) {
  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer">
      <div className="relative">
        <img 
          src={item.thumbnail} 
          alt={item.title}
          className="w-full h-auto object-cover"
        />
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
        <p className="text-sm truncate">{item.url}</p>
      </div>
    </div>
  );
}

function DocumentCard({ item }: { item: KnowledgeItem }) {
  const isPdf = item.fileType === "pdf";
  const iconColor = isPdf ? "text-orange-500" : "text-blue-500";
  
  return (
    <div className="rounded-xl bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer">
      <div className="h-32 flex flex-col items-center justify-center gap-2">
        <FileText className={cn("w-8 h-8", iconColor)} />
        <span className="text-sm text-muted-foreground">{item.fileType}</span>
      </div>
      <div className="p-3 border-t border-border">
        <p className="text-sm truncate">{item.title}</p>
      </div>
    </div>
  );
}

export default function Brain() {
  const [activeFilter, setActiveFilter] = useState("all");

  const getFilteredContent = () => {
    switch (activeFilter) {
      case "memories":
        return mockMemories;
      case "images":
        return mockImages;
      case "videos":
        return mockVideos;
      case "webpages":
        return mockWebpages;
      case "documents":
        return mockDocuments;
      case "all":
      default:
        return mockMemories; // Default to memories view
    }
  };

  const renderContent = () => {
    const content = getFilteredContent();
    
    switch (activeFilter) {
      case "memories":
      case "all":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(content as KnowledgeItem[]).map((item) => (
              <MemoryCard key={item.id} item={item} />
            ))}
          </div>
        );
      case "images":
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(content as KnowledgeItem[]).map((item) => (
              <ImageCard key={item.id} item={item} />
            ))}
          </div>
        );
      case "videos":
        return (
          <div className="columns-1 md:columns-2 lg:columns-4 gap-4 space-y-4">
            {(content as KnowledgeItem[]).map((item) => (
              <div key={item.id} className="break-inside-avoid">
                <VideoCard item={item} />
              </div>
            ))}
          </div>
        );
      case "webpages":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(content as KnowledgeItem[]).map((item) => (
              <WebpageCard key={item.id} item={item} />
            ))}
          </div>
        );
      case "documents":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(content as KnowledgeItem[]).map((item) => (
              <DocumentCard key={item.id} item={item} />
            ))}
          </div>
        );
      default:
        return null;
    }
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
        <div className="bg-[hsl(142,71%,45%,0.1)] border border-[hsl(142,71%,45%,0.3)] rounded-xl p-6 flex items-start gap-4">
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
            <>
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
              </Button>
              {index === 0 && (
                <Button
                  key="filter-btn"
                  variant="outline"
                  size="sm"
                  className="bg-card px-2"
                >
                  <Filter className="w-4 h-4" />
                </Button>
              )}
            </>
          ))}
        </div>

        {/* Content Grid */}
        {renderContent()}
      </div>
    </div>
  );
}
