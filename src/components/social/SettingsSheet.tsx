import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Trash2, Plus, Palette, FileText, Link2, HelpCircle, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsView = "menu" | "themes" | "instructions" | "platforms" | "how-it-works" | "setup";

interface ContentTheme {
  id: string;
  name: string;
  schedule: string;
  platforms: string[];
  enabled: boolean;
}

interface ConnectedPage {
  id: string;
  name: string;
  connected: boolean;
}

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultThemes: ContentTheme[] = [
  {
    id: "1",
    name: "AI-Driven Innovation in Rebar Supply",
    schedule: "1-2 posts per week",
    platforms: ["linkedin", "facebook", "youtube"],
    enabled: true,
  },
  {
    id: "2",
    name: "Behind-the-Scenes Shop Floor & Team Culture",
    schedule: "2 posts per week",
    platforms: ["instagram", "facebook", "tiktok"],
    enabled: false,
  },
  {
    id: "3",
    name: "Customer Success Stories & Partner Program",
    schedule: "1-2 posts per week",
    platforms: ["facebook", "linkedin", "instagram"],
    enabled: true,
  },
  {
    id: "4",
    name: "Educational Insights on Rebar & Construction Efficiency",
    schedule: "1 post per week, 1 video per month",
    platforms: ["linkedin", "facebook", "youtube"],
    enabled: false,
  },
  {
    id: "5",
    name: "Prefab Product Showcase & Ready Stock",
    schedule: "3 posts per week",
    platforms: ["instagram", "facebook", "youtube"],
    enabled: true,
  },
  {
    id: "6",
    name: "Sustainability & Energy Efficiency in Rebar Fabrication",
    schedule: "1 post every 2 weeks",
    platforms: ["linkedin", "facebook", "instagram"],
    enabled: false,
  },
];

const defaultConnectedPages: Record<string, ConnectedPage[]> = {
  facebook: [
    { id: "fb1", name: "Ontario Steel Detailing", connected: true },
    { id: "fb2", name: "Rebar.shop", connected: false },
    { id: "fb3", name: "Ontario Digital Marketing", connected: false },
    { id: "fb4", name: "Ontario Logistics", connected: false },
    { id: "fb5", name: "Ontario Steels", connected: false },
    { id: "fb6", name: "Rebar.shop Ontario", connected: false },
  ],
  instagram: [
    { id: "ig1", name: "ontariosteeldetailing", connected: true },
    { id: "ig2", name: "rebar.shop", connected: false },
    { id: "ig3", name: "ontariodigitalmarketing", connected: false },
    { id: "ig4", name: "ontariologistics.ca", connected: false },
    { id: "ig5", name: "ontariosteels.ca", connected: false },
    { id: "ig6", name: "rebar.shop_on", connected: false },
  ],
  linkedin: [
    { id: "li1", name: "ontariorebars@gmail.com", connected: true },
  ],
  youtube: [
    { id: "yt1", name: "Rebar Shop", connected: true },
  ],
};

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const [view, setView] = useState<SettingsView>("menu");
  const [themes, setThemes] = useState(defaultThemes);
  const [customInstructions, setCustomInstructions] = useState("Use hashtags, don't use emojis, etc.");
  const [connectedPages, setConnectedPages] = useState(defaultConnectedPages);

  const handleClose = () => {
    onOpenChange(false);
    setView("menu");
  };

  const toggleTheme = (id: string) => {
    setThemes(prev => prev.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
  };

  const deleteTheme = (id: string) => {
    setThemes(prev => prev.filter(t => t.id !== id));
  };

  const togglePage = (platform: string, pageId: string) => {
    setConnectedPages(prev => ({
      ...prev,
      [platform]: prev[platform].map(p => 
        p.id === pageId ? { ...p, connected: !p.connected } : p
      ),
    }));
  };

  const menuItems = [
    { id: "themes", label: "Content themes", icon: Palette, view: "themes" as SettingsView },
    { id: "instructions", label: "Custom instructions", icon: FileText, view: "instructions" as SettingsView },
    { id: "platforms", label: "Connected platforms", icon: Link2, view: "platforms" as SettingsView },
    { id: "how-it-works", label: "How it works", icon: HelpCircle, view: "how-it-works" as SettingsView },
    { id: "setup", label: "Setup from scratch", icon: Settings2, view: "setup" as SettingsView },
  ];

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-[400px] sm:w-[450px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center gap-2">
            {view !== "menu" && (
              <Button variant="ghost" size="icon" onClick={() => setView("menu")}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            <SheetTitle className="text-base">
              {view === "menu" && "Settings"}
              {view === "themes" && "Content themes"}
              {view === "instructions" && "Custom instructions"}
              {view === "platforms" && "Connected pages"}
              {view === "how-it-works" && "How it works"}
              {view === "setup" && "Setup from scratch"}
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Main Menu */}
          {view === "menu" && (
            <div className="p-2">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.view)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {/* Content Themes */}
          {view === "themes" && (
            <div className="p-4 space-y-3">
              {themes.map((theme) => (
                <div
                  key={theme.id}
                  className={cn(
                    "p-3 rounded-lg border transition-colors",
                    theme.enabled ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={theme.enabled}
                      onCheckedChange={() => toggleTheme(theme.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{theme.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {theme.schedule} on {theme.platforms.join(", ")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => deleteTheme(theme.id)}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}

              <button className="w-full flex items-center gap-2 p-3 text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="w-5 h-5" />
                <span>Add</span>
              </button>
            </div>
          )}

          {/* Custom Instructions */}
          {view === "instructions" && (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Custom instructions</label>
                <Textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Add your instructions..."
                  className="min-h-[100px] resize-none"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Soshie will follow these instructions when creating new posts.
              </p>
            </div>
          )}

          {/* Connected Platforms */}
          {view === "platforms" && (
            <div className="p-4 space-y-6">
              {Object.entries(connectedPages).map(([platform, pages]) => (
                <div key={platform} className="space-y-2">
                  <h3 className="text-sm font-medium capitalize">
                    {platform === "instagram" ? "Instagram (FB Pages)" : platform}
                  </h3>
                  <div className="space-y-1">
                    {pages.map((page) => (
                      <button
                        key={page.id}
                        onClick={() => togglePage(platform, page.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                          page.connected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                          page.connected ? "border-primary bg-primary" : "border-muted-foreground"
                        )}>
                          {page.connected && (
                            <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm">{page.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* How it works */}
          {view === "how-it-works" && (
            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                The Social Media Manager uses AI to help you create, schedule, and manage your social media content across multiple platforms.
              </p>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium text-sm">1. Connect your accounts</p>
                  <p className="text-xs text-muted-foreground mt-1">Link your Facebook, Instagram, LinkedIn, and YouTube accounts.</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium text-sm">2. Set up your brand kit</p>
                  <p className="text-xs text-muted-foreground mt-1">Add your logo, colors, and brand voice to maintain consistency.</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium text-sm">3. Create content themes</p>
                  <p className="text-xs text-muted-foreground mt-1">Define recurring topics and posting schedules.</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium text-sm">4. Generate & review posts</p>
                  <p className="text-xs text-muted-foreground mt-1">AI creates posts based on your themes. Review and schedule them.</p>
                </div>
              </div>
            </div>
          )}

          {/* Setup from scratch */}
          {view === "setup" && (
            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Start fresh with a new configuration. This will reset your content themes and custom instructions.
              </p>
              <Button variant="destructive" className="w-full">
                Reset all settings
              </Button>
            </div>
          )}
        </div>

        {/* Footer with Save button */}
        {view !== "menu" && view !== "how-it-works" && (
          <div className="p-4 border-t">
            <Button className="w-full" onClick={() => setView("menu")}>
              Save
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
