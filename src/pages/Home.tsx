// forwardRef cache bust
import React, { useState, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ChatInput } from "@/components/chat/ChatInput";
import { routeToAgent } from "@/lib/agentRouter";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AutomationsSection } from "@/components/integrations/AutomationsSection";
import { AgentSuggestionsPanel } from "@/components/agent/AgentSuggestionsPanel";
import { useUserRole } from "@/hooks/useUserRole";
import { 
  ChevronRight,
  Crown,
  Clock,
  MessageSquare,
  Languages,
  Factory,
  ShieldCheck,
  Send,
  PackageCheck,
  ArrowLeft,
  ClipboardList,
  Calculator,
} from "lucide-react";
import logoCoin from "@/assets/logo-coin.png";
import { useAuth } from "@/lib/auth";
import { getUserAgentMapping } from "@/lib/userAgentMap";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { VizzyDailyBriefing } from "@/components/vizzy/VizzyDailyBriefing";
import { MyJobsCard } from "@/components/shopfloor/MyJobsCard";

// Helper character images
import salesHelper from "@/assets/helpers/sales-helper.png";
import supportHelper from "@/assets/helpers/support-helper.png";
import accountingHelper from "@/assets/helpers/accounting-helper.png";
import estimatingHelper from "@/assets/helpers/estimating-helper.png";
import shopfloorHelper from "@/assets/helpers/shopfloor-helper.png";
import deliveryHelper from "@/assets/helpers/delivery-helper.png";
import emailHelper from "@/assets/helpers/email-helper.png";
import dataHelper from "@/assets/helpers/data-helper.png";
import socialHelper from "@/assets/helpers/social-helper.png";
import bizdevHelper from "@/assets/helpers/bizdev-helper.png";
import webbuilderHelper from "@/assets/helpers/webbuilder-helper.png";
import assistantHelper from "@/assets/helpers/assistant-helper.png";
import copywritingHelper from "@/assets/helpers/copywriting-helper.png";
import talentHelper from "@/assets/helpers/talent-helper.png";
import seoHelper from "@/assets/helpers/seo-helper.png";
import growthHelper from "@/assets/helpers/growth-helper.png";
import eisenhowerHelper from "@/assets/helpers/eisenhower-helper.png";

const agentKeyToSuggestion: Record<string, { code: string; name: string }> = {
  assistant: { code: "vizzy", name: "Vizzy" },
  accounting: { code: "penny", name: "Penny" },
  shopfloor: { code: "forge", name: "Forge" },
  sales: { code: "blitz", name: "Blitz" },
  estimating: { code: "gauge", name: "Gauge" },
  support: { code: "haven", name: "Haven" },
  email: { code: "relay", name: "Relay" },
  social: { code: "pixel", name: "Pixel" },
};

interface Helper {
  id: string;
  name: string;
  role: string;
  image: string;
  gradient: string;
  route: string;
}

const helpers: Helper[] = [
  { id: "sales", name: "Blitz", role: "Sales & Pipeline", image: salesHelper, gradient: "from-blue-500 to-blue-600", route: "/agent/sales" },
  { id: "support", name: "Haven", role: "Customer Support", image: supportHelper, gradient: "from-purple-500 to-purple-600", route: "/agent/support" },
  { id: "accounting", name: "Penny", role: "Accounting", image: accountingHelper, gradient: "from-green-500 to-green-600", route: "/agent/accounting" },
  { id: "estimating", name: "Gauge", role: "Estimating", image: estimatingHelper, gradient: "from-orange-500 to-orange-600", route: "/agent/estimating" },
  { id: "shopfloor", name: "Forge", role: "Shop Floor Commander", image: shopfloorHelper, gradient: "from-slate-500 to-slate-600", route: "/agent/shopfloor" },
  { id: "delivery", name: "Atlas", role: "Deliveries", image: deliveryHelper, gradient: "from-yellow-500 to-yellow-600", route: "/agent/delivery" },
  { id: "email", name: "Relay", role: "Email & Inbox", image: emailHelper, gradient: "from-pink-500 to-pink-600", route: "/agent/email" },
  { id: "social", name: "Pixel", role: "Social Media", image: socialHelper, gradient: "from-purple-500 to-pink-500", route: "/agent/social" },
  { id: "eisenhower", name: "Eisenhower Matrix", role: "Eisenhower Matrix", image: eisenhowerHelper, gradient: "from-amber-500 to-orange-600", route: "/agent/eisenhower" },
  { id: "data", name: "Prism", role: "Data & Insights", image: dataHelper, gradient: "from-teal-500 to-teal-600", route: "/agent/data" },
  { id: "bizdev", name: "Buddy", role: "Business Development", image: bizdevHelper, gradient: "from-blue-600 to-indigo-600", route: "/agent/bizdev" },
  { id: "webbuilder", name: "Commet", role: "Web Builder", image: webbuilderHelper, gradient: "from-orange-500 to-red-500", route: "/agent/webbuilder" },
  { id: "assistant", name: "Vizzy", role: "CEO Assistant", image: assistantHelper, gradient: "from-yellow-400 to-amber-500", route: "/agent/assistant" },
  { id: "copywriting", name: "Penn", role: "Copywriting", image: copywritingHelper, gradient: "from-emerald-500 to-teal-500", route: "/agent/copywriting" },
  { id: "talent", name: "Scouty", role: "Talent & HR", image: talentHelper, gradient: "from-cyan-400 to-cyan-600", route: "/agent/talent" },
  { id: "seo", name: "Seomi", role: "SEO & Search", image: seoHelper, gradient: "from-lime-500 to-green-600", route: "/agent/seo" },
  { id: "growth", name: "Gigi", role: "Personal Development", image: growthHelper, gradient: "from-green-400 to-emerald-600", route: "/agent/growth" },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const mapping = getUserAgentMapping(user?.email);
  const { isSuperAdmin } = useSuperAdmin();
  const { roles, isAdmin, isWorkshop, hasRole } = useUserRole();

  // Resolve agent for suggestions
  const agentSuggestion = useMemo(() => {
    if (mapping) {
      const mapped = agentKeyToSuggestion[mapping.agentKey];
      if (mapped) return mapped;
    }
    if (isAdmin) return agentKeyToSuggestion["assistant"];
    if (roles.includes("accounting")) return agentKeyToSuggestion["accounting"];
    if (isWorkshop) return agentKeyToSuggestion["shopfloor"];
    if (roles.includes("sales")) return agentKeyToSuggestion["sales"];
    return agentKeyToSuggestion["assistant"];
  }, [mapping, isAdmin, isWorkshop, roles]);

  // Reorder helpers: primary agent first
  const orderedHelpers = useMemo(() => {
    let filtered = isSuperAdmin ? helpers : helpers.filter((h) => h.id !== "assistant");
    // Hide accounting agent (Penny) from users without admin/accounting role
    if (!hasRole("admin") && !hasRole("accounting")) {
      filtered = filtered.filter((h) => h.id !== "accounting");
    }
    if (!mapping) return filtered;
    const primary = filtered.find((h) => h.id === mapping.agentKey);
    if (!primary) return filtered;
    return [primary, ...filtered.filter((h) => h.id !== mapping.agentKey)];
  }, [mapping, isSuperAdmin, hasRole]);

  const handleSend = useCallback((content: string) => {
    const result = routeToAgent(content);
    navigate(result.route, { state: { initialMessage: content } });
  }, [navigate]);

  const handleHelperClick = (helper: Helper) => {
    navigate(helper.route);
  };

  // heroTitle is now rendered inline in JSX (no dangerouslySetInnerHTML)

  // Shopfloor-only dashboard for workshop users
  if (isWorkshop && !isAdmin) {
    const shopfloorCards = [
      { label: "MATERIAL POOL", subtitle: "STAGING & FLOW", icon: <Factory className="w-7 h-7" />, to: "/shopfloor/pool" },
      { label: "SHOP FLOOR", subtitle: "MACHINES & STATIONS", icon: <Factory className="w-7 h-7" />, to: "/shopfloor/station" },
      { label: "CLEARANCE", subtitle: "QC & EVIDENCE", icon: <ShieldCheck className="w-7 h-7" />, to: "/shopfloor/clearance" },
      { label: "LOADING ST.", subtitle: "LOAD & EVIDENCE", icon: <PackageCheck className="w-7 h-7" />, to: "/shopfloor/loading" },
      { label: "DELIVERY", subtitle: "DISPATCH & LOADING", icon: <Send className="w-7 h-7" />, to: "/deliveries" },
      { label: "PICKUP ST.", subtitle: "CUSTOMER COLLECTION", icon: <PackageCheck className="w-7 h-7" />, to: "/shopfloor/pickup" },
      { label: "INVENTORY", subtitle: "COUNTS & ADJUSTMENTS", icon: <ClipboardList className="w-7 h-7" />, to: "/shopfloor/inventory" },
      { label: "ESTIMATION", subtitle: "AI TAKEOFF & BIDS", icon: <Calculator className="w-7 h-7" />, to: "/estimation" },
    ];

    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen bg-background overflow-hidden">
        {/* Radial glow background */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full bg-destructive/10 blur-[180px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px]" />
        </div>

        {/* Header */}
        <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider text-foreground uppercase">Command Hub</h2>
              <p className="text-[10px] tracking-widest text-primary uppercase">Access Granted via Identity</p>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center w-full max-w-4xl px-4 py-24">
          <h1 className="text-4xl sm:text-5xl font-black italic text-foreground tracking-tight text-center mb-1">
            SELECT INTERFACE
          </h1>
          <p className="text-xs tracking-[0.3em] text-primary/70 uppercase mb-10">
            Production Environment Active
          </p>

          {/* My Jobs Card */}
          <div className="w-full mb-6">
            <MyJobsCard />
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
            {shopfloorCards.map((card) => (
              <Link
                key={card.label}
                to={card.to}
                className="group relative flex flex-col items-center justify-center gap-3 p-6 sm:p-8 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:border-primary/40 transition-all duration-200 hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]"
              >
                <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {card.icon}
                </div>
                <div className="text-center">
                  <span className="text-xs sm:text-sm font-bold tracking-wider text-foreground/90 group-hover:text-foreground uppercase">
                    {card.label}
                  </span>
                  {card.subtitle && (
                    <p className="text-[9px] tracking-widest text-primary/60 uppercase mt-0.5">
                      {card.subtitle}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="relative flex flex-col items-center px-3 py-4 sm:px-6 sm:py-8 max-w-6xl mx-auto">
        {/* Big logo background */}
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
          <img src={logoCoin} alt="" className="w-[600px] h-[600px] opacity-[0.04]" />
        </div>

        {/* Hero Section */}
        <div className="relative z-10 w-full max-w-2xl text-center mb-6 sm:mb-12">
          <h1 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2">
            {mapping ? (
              <>
                {mapping.heroText.split(/\*\*(.*?)\*\*/g).map((part, i) =>
                  i % 2 === 1 ? <span key={i} className="text-primary">{part}</span> : part
                )}
              </>
            ) : (
              "How can REBAR SHOP OS help you today?"
            )}
          </h1>
          <p className="text-xs sm:text-base text-muted-foreground mb-4 sm:mb-8">
            Your AI-powered operations assistant
          </p>
          <div className="w-full">
            <ChatInput
              onSend={handleSend}
              placeholder={mapping ? `Ask ${agentKeyToSuggestion[mapping.agentKey]?.name ?? mapping.agentKey} anything...` : "Ask anything about your business..."}
              showFileUpload
              
            />
          </div>
        </div>

        {/* Daily Briefing (super admin only) */}
        {isSuperAdmin && (
          <div className="relative z-10 w-full">
            <VizzyDailyBriefing />
          </div>
        )}

        {/* Agent Suggestions (replaces Quick Actions) */}
        <div className="relative z-10 w-full mb-6 sm:mb-12">
          <AgentSuggestionsPanel agentCode={agentSuggestion.code} agentName={agentSuggestion.name} />
        </div>

        {/* Workspaces Section */}
        <div className="relative z-10 w-full mb-6 sm:mb-12">
          <h2 className="text-sm sm:text-lg font-semibold mb-2 sm:mb-4">Workspaces</h2>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {[
              { label: "CEO Portal", icon: Crown, route: "/ceo", gradient: "from-amber-500 via-orange-500 to-yellow-600", emoji: "👑" },
              { label: "Time Clock", icon: Clock, route: "/timeclock", gradient: "from-teal-500 via-emerald-500 to-cyan-500", emoji: "⏱" },
              { label: "Team Hub", icon: MessageSquare, route: "/team-hub", gradient: "from-indigo-500 via-purple-500 to-violet-500", emoji: "💬" },
              { label: "Transcribe", icon: Languages, route: "/transcribe", gradient: "from-pink-500 via-rose-500 to-red-500", emoji: "🎙️" },
            ].map((ws) => (
              <div
                key={ws.label}
                role="button"
                tabIndex={0}
                className={`relative overflow-hidden rounded-xl p-2.5 sm:p-4 text-white cursor-pointer transition-all hover:scale-[1.03] active:scale-[0.98] bg-gradient-to-br ${ws.gradient} flex flex-col items-center gap-1 sm:flex-row sm:gap-3`}
                onClick={() => navigate(ws.route)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(ws.route); } }}
              >
                <span className="text-lg sm:text-xl">{ws.emoji}</span>
                <span className="relative z-10 font-bold text-[10px] sm:text-base text-center sm:text-left leading-tight">{ws.label}</span>
                <ChevronRight className="w-4 h-4 text-white/60 hidden sm:block ml-auto relative z-10" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />
              </div>
            ))}
          </div>
        </div>

        {/* Automations Section */}
        <div className="relative z-10 w-full mb-6 sm:mb-12">
          <AutomationsSection />
        </div>

        {/* Helpers Section */}
        <div className="relative z-10 w-full">
          <h2 className="text-sm sm:text-lg font-semibold mb-2 sm:mb-4">Your Helpers</h2>
          <div className="grid grid-cols-4 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-4">
            {orderedHelpers.map((helper) => (
              <HelperCard
                key={helper.id}
                helper={helper}
                isPrimary={mapping?.agentKey === helper.id}
                onClick={() => handleHelperClick(helper)}
              />
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

const HelperCard = React.forwardRef<HTMLDivElement, { helper: Helper; isPrimary?: boolean; onClick: () => void }>(function HelperCard({ helper, isPrimary, onClick }, ref) {
  return (
    <Card
      ref={ref}
      className={`overflow-hidden cursor-pointer group hover:scale-[1.02] active:scale-[0.98] transition-transform duration-150 ease-out ${isPrimary ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
    >
      <div className="relative">
        <div className="aspect-square overflow-hidden bg-muted/50">
          <img src={helper.image} alt={`${helper.name} – ${helper.role}`} className="w-full h-full object-contain object-top" />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 pt-4 sm:relative sm:bg-transparent sm:p-3 sm:pt-3">
          <h3 className="font-bold text-[10px] sm:text-base leading-tight truncate text-white sm:text-foreground">{helper.name}</h3>
          <p className="text-[8px] sm:text-sm text-white/70 sm:text-foreground/60 truncate">{helper.role}</p>
          {isPrimary && <span className="text-[7px] sm:text-xs text-primary font-medium">Your Agent</span>}
        </div>
      </div>
    </Card>
  );
});
HelperCard.displayName = "HelperCard";
