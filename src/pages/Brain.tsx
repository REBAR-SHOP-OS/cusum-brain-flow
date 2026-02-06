import { useState } from "react";
import { 
  Search, Plus, MoreHorizontal, Brain as BrainIcon, 
  Image, Video, Globe, FileText, Check, ChevronRight,
  Linkedin, Facebook, Calendar, Mail
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ContentFilter {
  id: string;
  label: string;
  icon: React.ElementType;
  active?: boolean;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  connected: boolean;
}

interface KnowledgeItem {
  id: string;
  title: string;
  type: string;
  thumbnail?: string;
}

const contentFilters: ContentFilter[] = [
  { id: "search", label: "Search", icon: Search },
  { id: "all", label: "All", icon: Globe, active: true },
  { id: "memories", label: "Memories", icon: BrainIcon },
  { id: "images", label: "Images", icon: Image },
  { id: "videos", label: "Videos", icon: Video },
  { id: "webpages", label: "Webpages", icon: Globe },
  { id: "documents", label: "Documents", icon: FileText },
];

const integrations: Integration[] = [
  { id: "linkedin-personal", name: "LinkedIn (Personal)", description: "Create and share posts with your...", icon: Linkedin, iconBg: "bg-[#0077B5]", connected: true },
  { id: "linkedin-org", name: "LinkedIn (Organization)", description: "Create and share posts on your...", icon: Linkedin, iconBg: "bg-[#0077B5]", connected: true },
  { id: "facebook", name: "Facebook", description: "Manage Facebook and Instagram...", icon: Facebook, iconBg: "bg-[#1877F2]", connected: true },
  { id: "gmail", name: "Gmail", description: "Let helpers send emails and read...", icon: Mail, iconBg: "bg-[#EA4335]", connected: true },
  { id: "google-calendar", name: "Google Calendar", description: "Allow helpers to see and schedule...", icon: Calendar, iconBg: "bg-[#4285F4]", connected: true },
  { id: "outlook", name: "Outlook", description: "Handle your Outlook emails", icon: Mail, iconBg: "bg-[#0078D4]", connected: true },
];

const mockKnowledge: KnowledgeItem[] = [
  { id: "1", title: "Start your day with purpose...", type: "memory" },
  { id: "2", title: "Rebar specifications guide", type: "document" },
  { id: "3", title: "Language Preference", type: "setting" },
];

export default function Brain() {
  const [activeFilter, setActiveFilter] = useState("all");

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

      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* How Brain AI Works Banner */}
        <div className="bg-[hsl(142,71%,45%,0.1)] border border-[hsl(142,71%,45%,0.3)] rounded-xl p-6 flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-[hsl(142,71%,45%,0.2)] flex items-center justify-center flex-shrink-0">
            <BrainIcon className="w-8 h-8 text-success" />
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
            </Button>
          ))}
        </div>

        {/* Help AI Get Smarter */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
              <span className="text-warning font-semibold">10</span>
            </div>
            <div>
              <p className="font-medium">Help your AI get smarter</p>
              <p className="text-sm text-muted-foreground">Answer 10 quick questions to make it work better for you</p>
            </div>
          </div>
          <Button variant="default" className="gap-2">
            Answer Questions
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Integrations */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Integrations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer"
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", integration.iconBg)}>
                  <integration.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{integration.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{integration.description}</p>
                </div>
                {integration.connected && (
                  <Badge variant="outline" className="gap-1 text-success border-success/30 bg-success/10">
                    Connected
                    <Check className="w-3 h-3" />
                  </Badge>
                )}
              </div>
            ))}
          </div>
          <button className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-4 py-2">
            Show all apps
          </button>
        </section>

        {/* Knowledge */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Knowledge</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mockKnowledge.map((item) => (
              <div
                key={item.id}
                className="rounded-xl bg-card border border-border overflow-hidden hover:border-primary/30 transition-colors cursor-pointer"
              >
                <div className="h-24 bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                  <BrainIcon className="w-8 h-8 text-primary/50" />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
