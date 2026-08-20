import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Settings, Sparkles, Loader2, Mail,
  ThumbsUp, Users, ShieldOff, TrendingUp, Send, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SmartSearchInput } from "@/components/ui/SmartSearchInput";
import { CampaignCard } from "@/components/email-marketing/CampaignCard";
import { CampaignReviewPanel } from "@/components/email-marketing/CampaignReviewPanel";
import { CreateCampaignDialog } from "@/components/email-marketing/CreateCampaignDialog";
import { SuppressionManager } from "@/components/email-marketing/SuppressionManager";
import { AutomationsPanel } from "@/components/email-marketing/AutomationsPanel";
import { useEmailCampaigns, useSuppressions, type EmailCampaign } from "@/hooks/useEmailCampaigns";
import { cn } from "@/lib/utils";
const statusFilters = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "pending_approval", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "sending", label: "Sending" },
  { id: "sent", label: "Sent" },
];

const searchHints = [
  { category: "Date", suggestions: ["today", "this week", "this month"] },
  { category: "Status", suggestions: ["draft", "pending", "approved", "sent"] },
  { category: "Type", suggestions: ["newsletter", "nurture", "follow-up", "winback"] },
];

export default function EmailMarketing() {
  const navigate = useNavigate();
  const { campaigns, isLoading } = useEmailCampaigns();
  const { suppressions } = useSuppressions();

  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSuppressions, setShowSuppressions] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let items = campaigns;
    if (statusFilter !== "all") {
      items = items.filter((c) => c.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.subject_line || "").toLowerCase().includes(q) ||
          c.campaign_type.toLowerCase().includes(q)
      );
    }
    return items;
  }, [campaigns, statusFilter, searchQuery]);

  const pendingCount = campaigns.filter((c) => c.status === "pending_approval").length;
  const sentThisMonth = campaigns.filter((c) => {
    if (!c.sent_at) return false;
    const d = new Date(c.sent_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border gap-2 sm:gap-0 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/integrations")}>
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <h1 className="text-base sm:text-xl font-semibold">Email Marketing</h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          <Button onClick={() => setShowCreate(true)} size="sm" className="bg-primary hover:bg-primary/90 gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Campaign</span>
            <span className="sm:hidden">New</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSuppressions(true)} className="gap-1.5">
            <ShieldOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Suppressions</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Dashboard Cards */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => {
              setStatusFilter("pending_approval");
              const first = campaigns.find((c) => c.status === "pending_approval");
              if (first) setSelectedCampaign(first);
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <ThumbsUp className="w-5 h-5 shrink-0" />
            <span className="font-medium">{pendingCount} to review</span>
          </button>

          <div className="flex items-center gap-4 sm:gap-6 sm:ml-auto">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              <div>
                <p className="text-xl sm:text-2xl font-bold">{sentThisMonth}</p>
                <p className="text-xs text-muted-foreground">Sent this month</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShieldOff className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              <div>
                <p className="text-xl sm:text-2xl font-bold">{suppressions.length}</p>
                <p className="text-xs text-muted-foreground">Suppressed</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              <div>
                <p className="text-xl sm:text-2xl font-bold">{campaigns.length}</p>
                <p className="text-xs text-muted-foreground">Total campaigns</p>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="campaigns">
          <TabsList className="mb-4">
            <TabsTrigger value="campaigns" className="gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Campaigns
            </TabsTrigger>
            <TabsTrigger value="automations" className="gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Automations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns">
            {/* Filters */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-thin mb-4">
              <div className="shrink-0 w-40 sm:w-52">
                <SmartSearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search campaigns..."
                  hints={searchHints}
                />
              </div>
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
            </div>

            {/* Campaign List */}
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
                <p className="text-muted-foreground text-sm max-w-md mb-4">
                  Create your first AI-powered email campaign. Describe your goals and the AI will draft everything — you just approve.
                </p>
                <Button onClick={() => setShowCreate(true)} className="gap-2">
                  <Sparkles className="w-4 h-4" /> Create campaign
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((c) => (
                  <CampaignCard
                    key={c.id}
                    campaign={c}
                    onClick={() => setSelectedCampaign(c)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="automations">
            <AutomationsPanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Panel */}
      <CampaignReviewPanel
        campaign={selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
      />

      {/* Create Dialog */}
      <CreateCampaignDialog open={showCreate} onOpenChange={setShowCreate} />

      {/* Suppression Manager */}
      <SuppressionManager open={showSuppressions} onOpenChange={setShowSuppressions} />
    </div>
  );
}
