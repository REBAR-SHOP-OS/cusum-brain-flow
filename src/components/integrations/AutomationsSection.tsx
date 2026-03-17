// forwardRef cache bust
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bot, Mail, FileText, MessageCircle, Sparkles, Send, Globe, Code, Search, Video, Camera } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  color: "purple" | "blue" | "gold" | "teal" | "red";
  icon: "social" | "inbox" | "summary" | "comment" | "email" | "website" | "code" | "search" | "video" | "camera";
  beta?: boolean;
  route?: string;
  highlights?: string[];
}

const defaultAutomations: Automation[] = [
  {
    id: "social-media-manager",
    name: "Social Media Manager",
    description: "Save hours — auto-schedule and publish across all channels",
    enabled: true,
    color: "purple",
    icon: "social",
    route: "/social-media-manager",
    highlights: ["AI captions & hashtags", "Multi-platform scheduling"],
  },
  {
    id: "inbox-manager",
    name: "Inbox Manager",
    description: "Never miss a lead — smart triage and priority sorting",
    enabled: true,
    color: "blue",
    icon: "inbox",
    route: "/home",
  },
  {
    id: "daily-summarizer",
    name: "Daily Summarizer",
    description: "Start each day informed with automated activity digests",
    enabled: true,
    color: "gold",
    icon: "summary",
    route: "/daily-summarizer",
  },
  {
    id: "facebook-commenter",
    name: "Facebook Commenter",
    description: "Keep engagement high with instant auto-replies",
    enabled: true,
    color: "blue",
    icon: "comment",
    route: "/facebook-commenter",
  },
  {
    id: "email-marketing",
    name: "Email Marketing",
    description: "Launch targeted campaigns with AI copy and human approval",
    enabled: true,
    color: "teal",
    icon: "email",
    route: "/email-marketing",
    highlights: ["AI-written subject lines & body", "One-click approve & send"],
  },
  {
    id: "website-manager",
    name: "Website Manager",
    description: "Edit and manage rebar.shop visually with AI assistance",
    enabled: true,
    color: "blue",
    icon: "website",
    route: "/website",
  },
  {
    id: "app-builder",
    name: "App Builder",
    description: "Architect new ventures powered by your ERP data",
    enabled: true,
    color: "red",
    icon: "code",
    route: "/empire",
  },
  {
    id: "seo-manager",
    name: "SEO Manager",
    description: "Boost rankings with automated SEO audits and fixes",
    enabled: true,
    color: "teal",
    icon: "search",
    route: "/seo",
  },
  {
    id: "automations-hub",
    name: "Automations Hub",
    description: "17 AI automations for revenue, pipeline, and production",
    enabled: true,
    color: "red",
    icon: "code",
    route: "/automations",
  },
  {
    id: "video-generator",
    name: "AI Video Studio",
    description: "Generate videos, images & audio from a single prompt",
    enabled: true,
    color: "purple",
    icon: "video",
    route: "/video-studio",
  },
  {
    id: "ad-director",
    name: "AI Video Director",
    description: "Turn sales scripts into polished 30s B2B ads in minutes",
    enabled: true,
    color: "red",
    icon: "video",
    route: "/ad-director",
    highlights: ["Auto voice, edit & subtitle", "Export share-ready ads"],
  },
  {
    id: "camera-intelligence",
    name: "Camera AI",
    description: "Real-time vision & dispatch intelligence for the shop floor",
    enabled: true,
    color: "teal",
    icon: "camera",
    route: "/shopfloor/camera-intelligence",
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
  video: Video,
  camera: Camera,
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
  const { user } = useAuth();
  const [automations, setAutomations] = useState(defaultAutomations);

  const visibleAutomations = useMemo(() => {
    if (isAdmin) return automations;
    const email = user?.email?.toLowerCase() ?? "";
    const extraAllowed = email === "zahra@rebar.shop" ? new Set(["social-media-manager"]) : new Set<string>();
    return automations.filter((a) => !ADMIN_ONLY_IDS.has(a.id) || extraAllowed.has(a.id));
  }, [automations, isAdmin, user?.email]);

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
