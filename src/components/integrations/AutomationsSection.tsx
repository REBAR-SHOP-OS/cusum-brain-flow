// forwardRef cache bust
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bot, Mail, FileText, MessageCircle, Sparkles, Send, Globe, Code, Search } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

export interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  color: "purple" | "blue" | "gold" | "teal" | "red";
  icon: "social" | "inbox" | "summary" | "comment" | "email" | "website" | "code" | "search";
  beta?: boolean;
  route?: string;
}

const defaultAutomations: Automation[] = [
  {
    id: "social-media-manager",
    name: "Social Media Manager",
    description: "Auto-schedule and post to social platforms",
    enabled: true,
    color: "purple",
    icon: "social",
    route: "/social-media-manager",
  },
  {
    id: "inbox-manager",
    name: "Inbox Manager",
    description: "Organize and prioritize incoming emails",
    enabled: true,
    color: "blue",
    icon: "inbox",
    route: "/home",
  },
  {
    id: "daily-summarizer",
    name: "Daily Summarizer",
    description: "Get daily digests of key activities",
    enabled: true,
    color: "gold",
    icon: "summary",
    route: "/daily-summarizer",
  },
  {
    id: "facebook-commenter",
    name: "Facebook Commenter",
    description: "Auto-respond to comments and messages",
    enabled: true,
    color: "blue",
    icon: "comment",
    route: "/facebook-commenter",
  },
  {
    id: "email-marketing",
    name: "Email Marketing",
    description: "AI-driven campaigns with human approval",
    enabled: true,
    color: "teal",
    icon: "email",
    route: "/email-marketing",
  },
  {
    id: "website-manager",
    name: "Website Manager",
    description: "Visual editing and AI management for rebar.shop",
    enabled: true,
    color: "blue",
    icon: "website",
    route: "/website",
  },
  {
    id: "app-builder",
    name: "App Builder",
    description: "Venture architect with ERP & Odoo data",
    enabled: true,
    color: "red",
    icon: "code",
    route: "/empire",
  },
  {
    id: "seo-manager",
    name: "SEO Manager",
    description: "AI-driven SEO audits for rebar.shop",
    enabled: true,
    color: "teal",
    icon: "search",
    route: "/seo",
  },
  {
    id: "automations-hub",
    name: "Automations Hub",
    description: "17 AI automations for revenue, pipeline, production",
    enabled: true,
    color: "red",
    icon: "code",
    route: "/automations",
  },
];

const colorGradients = {
  purple: "bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500",
  blue: "bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500",
  gold: "bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-400",
  teal: "bg-gradient-to-br from-teal-500 via-emerald-500 to-green-400",
  red: "bg-gradient-to-br from-red-500 via-orange-500 to-amber-500",
};

const iconComponents = {
  social: Sparkles,
  inbox: Mail,
  summary: FileText,
  comment: MessageCircle,
  email: Send,
  website: Globe,
  code: Code,
  search: Search,
};

interface AutomationCardProps {
  automation: Automation;
  onToggle: (id: string, enabled: boolean) => void;
  onClick?: () => void;
}

const AutomationCard = React.forwardRef<HTMLDivElement, AutomationCardProps>(function AutomationCard({ automation, onToggle, onClick }, ref) {
  const Icon = iconComponents[automation.icon];

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl p-4 text-white transition-transform hover:scale-[1.02] cursor-pointer",
        colorGradients[automation.color]
      )}
    >
      {/* Content */}
      <div className="relative z-10">
        <h3 className="text-lg font-bold leading-tight mb-1">{automation.name}</h3>
        <p className="text-sm text-white/70 mb-3">{automation.description}</p>

        <div className="flex items-center gap-3">
          <Switch
            checked={automation.enabled}
            onCheckedChange={(checked) => {
              // Prevent navigation when clicking the switch
              onToggle(automation.id, checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="data-[state=checked]:bg-white/30 data-[state=unchecked]:bg-white/20"
          />
          {automation.beta && (
            <Badge
              variant="secondary"
              className="bg-white/20 text-white border-0 hover:bg-white/30"
            >
              Beta
            </Badge>
          )}
        </div>
      </div>

      {/* Decorative Icon */}
      <div className="absolute right-4 bottom-4 opacity-20">
        <Icon className="w-16 h-16" strokeWidth={1} />
      </div>

      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
    </div>
  );
});
AutomationCard.displayName = "AutomationCard";

const ADMIN_ONLY_IDS = new Set([
  "social-media-manager", "facebook-commenter", "email-marketing",
  "website-manager", "app-builder", "seo-manager",
]);

export const AutomationsSection = React.forwardRef<HTMLElement, {}>(function AutomationsSection(_props, ref) {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [automations, setAutomations] = useState(defaultAutomations);

  const visibleAutomations = useMemo(
    () => isAdmin ? automations : automations.filter((a) => !ADMIN_ONLY_IDS.has(a.id)),
    [automations, isAdmin]
  );

  const handleToggle = (id: string, enabled: boolean) => {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled } : a))
    );
  };

  const handleCardClick = (automation: Automation) => {
    if (automation.route) {
      navigate(automation.route);
    }
  };

  return (
    <section ref={ref} className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Automations</h2>
        <Badge variant="outline" className="text-xs">
          AI-Powered
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleAutomations.map((automation) => (
          <AutomationCard
            key={automation.id}
            automation={automation}
            onToggle={handleToggle}
            onClick={() => handleCardClick(automation)}
          />
        ))}
      </div>
    </section>
  );
});
AutomationsSection.displayName = "AutomationsSection";
