import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChatInput } from "@/components/chat/ChatInput";
import { routeToAgent } from "@/lib/agentRouter";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AutomationsSection } from "@/components/integrations/AutomationsSection";
import { 
  TrendingUp, 
  FileText, 
  Truck, 
  Mail,
  ChevronRight,
  Activity,
  AlertTriangle,
  Users,
  Cog,
  Wrench,
  ListOrdered,
  RefreshCw,
  Crown,
  Clock,
  MessageSquare,
  Languages,
} from "lucide-react";
import logoCoin from "@/assets/logo-coin.png";
import { useAuth } from "@/lib/auth";
import { getUserAgentMapping } from "@/lib/userAgentMap";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

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

const iconMap: Record<string, React.ElementType> = {
  TrendingUp, FileText, Truck, Mail, Activity, AlertTriangle, Users, Cog, Wrench, ListOrdered, RefreshCw,
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

interface UseCase {
  title: string;
  icon: React.ElementType;
  category: string;
  route: string;
  prompt: string;
}

const defaultUseCases: UseCase[] = [
  { title: "Check my pipeline status", icon: TrendingUp, category: "Sales", route: "/agent/sales", prompt: "Check my pipeline status. Show me a summary of active leads, their stages, and expected close dates." },
  { title: "Create a quote for a customer", icon: FileText, category: "Estimating", route: "/agent/estimating", prompt: "Help me create a new quote for a customer. Walk me through the process step by step." },
  { title: "Track today's deliveries", icon: Truck, category: "Operations", route: "/agent/delivery", prompt: "Show me today's delivery schedule. What's the status of all active deliveries?" },
  { title: "Summarize today's emails", icon: Mail, category: "Productivity", route: "/agent/email", prompt: "Summarize today's emails. Highlight anything urgent or requiring my attention." },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const mapping = getUserAgentMapping(user?.email);
  const { isSuperAdmin } = useSuperAdmin();

  // Build personalized quick actions
  const useCases: UseCase[] = useMemo(() => {
    if (!mapping) return defaultUseCases;
    return mapping.quickActions.map((qa) => ({
      title: qa.title,
      icon: iconMap[qa.icon] || FileText,
      category: qa.category,
      route: `/agent/${mapping.agentKey}`,
      prompt: qa.prompt,
    }));
  }, [mapping]);

  // Reorder helpers: primary agent first
  const orderedHelpers = useMemo(() => {
    // Hide Vizzy (assistant) for non-super-admins
    const filtered = isSuperAdmin ? helpers : helpers.filter((h) => h.id !== "assistant");
    if (!mapping) return filtered;
    const primary = filtered.find((h) => h.id === mapping.agentKey);
    if (!primary) return filtered;
    return [primary, ...filtered.filter((h) => h.id !== mapping.agentKey)];
  }, [mapping, isSuperAdmin]);

  const handleSend = useCallback((content: string) => {
    const result = routeToAgent(content);
    navigate(result.route, { state: { initialMessage: content } });
  }, [navigate]);

  const handleHelperClick = (helper: Helper) => {
    navigate(helper.route);
  };

  const handleUseCaseClick = (useCase: UseCase) => {
    navigate(useCase.route, { state: { initialMessage: useCase.prompt } });
  };

  const handleLiveChatClick = () => {
    navigate("/vizzy");
  };

  // Hero text
  const heroTitle = mapping
    ? mapping.heroText.replace(/\*\*(.*?)\*\*/g, '<span class="text-primary">$1</span>')
    : "How can REBAR SHOP OS help you today?";

  return (
    <ScrollArea className="h-full">
      <div className="relative flex flex-col items-center px-3 py-4 sm:px-6 sm:py-8 max-w-6xl mx-auto pb-20 md:pb-0">
        {/* Big logo background */}
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
          <img src={logoCoin} alt="" className="w-[600px] h-[600px] opacity-[0.04]" />
        </div>

        {/* Hero Section */}
        <div className="relative z-10 w-full max-w-2xl text-center mb-6 sm:mb-12">
          <h1
            className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2"
            dangerouslySetInnerHTML={{ __html: heroTitle }}
          />
          <p className="text-xs sm:text-base text-muted-foreground mb-4 sm:mb-8">
            Your AI-powered operations assistant
          </p>
          <div className="w-full">
            <ChatInput
              onSend={handleSend}
              placeholder={mapping ? `Ask ${mapping.agentKey === "assistant" ? "Vizzy" : mapping.agentKey === "shopfloor" ? "Forge" : "Gauge"} anything...` : "Ask anything about your business..."}
              showFileUpload
              onLiveChatClick={isSuperAdmin ? handleLiveChatClick : undefined}
            />
          </div>
        </div>

        {/* Use Cases Section */}
        <div className="relative z-10 w-full mb-6 sm:mb-12">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <h2 className="text-sm sm:text-lg font-semibold">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {useCases.map((useCase) => (
              <Card
                key={useCase.title}
                className="p-3 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors group"
                onClick={() => handleUseCaseClick(useCase)}
              >
                <p className="font-medium mb-2 sm:mb-3 line-clamp-2 text-xs sm:text-base">{useCase.title}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm text-muted-foreground">
                    <useCase.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{useCase.category}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Card>
            ))}
          </div>
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
                className={`relative overflow-hidden rounded-xl p-2.5 sm:p-4 text-white cursor-pointer transition-all hover:scale-[1.03] active:scale-[0.98] bg-gradient-to-br ${ws.gradient} flex flex-col items-center gap-1 sm:flex-row sm:gap-3`}
                onClick={() => navigate(ws.route)}
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
        <div className="aspect-square overflow-hidden bg-muted">
          <img src={helper.image} alt={helper.name} className="w-full h-full object-cover object-top" />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 pt-4 sm:relative sm:bg-transparent sm:p-3 sm:pt-3">
          <h3 className="font-bold text-[10px] sm:text-base leading-tight truncate text-white sm:text-foreground">{helper.name}</h3>
          <p className="text-[8px] sm:text-sm text-white/70 sm:text-muted-foreground truncate">{helper.role}</p>
          {isPrimary && <span className="text-[7px] sm:text-xs text-primary font-medium">Your Agent</span>}
        </div>
      </div>
    </Card>
  );
});
HelperCard.displayName = "HelperCard";
