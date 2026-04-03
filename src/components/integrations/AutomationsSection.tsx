// forwardRef cache bust
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bot, Camera, ChevronRight, Code, FileText, Globe, Mail, MessageCircle, Search, Send, Sparkles, Video } from "lucide-react";
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
    route: "/app-builder",
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
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1}
      className={cn(
        "group relative min-h-[176px] cursor-pointer overflow-hidden rounded-[28px] border border-white/15 p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_28px_70px_rgba(15,23,42,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        colorGradients[automation.color]
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-black/10" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 via-black/5 to-transparent" />
      <div className="absolute -right-10 -top-8 h-36 w-36 rounded-full bg-white/10 blur-3xl" />

      <div className="relative z-10 flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-black/10 backdrop-blur-sm">
            <Icon className="h-6 w-6" strokeWidth={1.75} />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {automation.beta && (
              <Badge
                variant="secondary"
                className="rounded-full border-0 bg-white/18 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white hover:bg-white/25"
              >
                Beta
              </Badge>
            )}

            <div className="rounded-full border border-white/15 bg-black/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm">
              {automation.enabled ? "Live" : "Paused"}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold leading-tight tracking-tight">{automation.name}</h3>
          <p className="max-w-[32ch] text-sm leading-6 text-white/78">{automation.description}</p>
        </div>

        {automation.highlights && automation.highlights.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {automation.highlights.map((h) => (
              <li
                key={h}
                className="rounded-full border border-white/15 bg-black/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm"
              >
                {h}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Automation
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-white/90">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  automation.enabled
                    ? "bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,0.18)]"
                    : "bg-white/45"
                )}
              />
              {automation.enabled ? "Enabled" : "Disabled"}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-full border border-white/15 bg-black/10 px-3 py-2 backdrop-blur-sm">
            <Switch
              checked={automation.enabled}
              onCheckedChange={(checked) => onToggle(automation.id, checked)}
              onClick={(e) => e.stopPropagation()}
              className="data-[state=checked]:bg-white data-[state=unchecked]:bg-white/25 [&>span]:bg-slate-950 data-[state=unchecked]:[&>span]:bg-white"
              aria-label={`Toggle ${automation.name}`}
            />
            <div className="flex items-center gap-1 text-sm font-semibold text-white/90">
              <span>Open</span>
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-5 right-5 opacity-[0.08]">
        <Icon className="h-16 w-16" strokeWidth={1} />
      </div>
    </div>
  );
});
AutomationCard.displayName = "AutomationCard";

const ADMIN_ONLY_IDS = new Set([
  "social-media-manager", "facebook-commenter", "email-marketing",
  "website-manager", "app-builder", "seo-manager",
]);

export const AutomationsSection = React.forwardRef<HTMLElement, Record<string, never>>(function AutomationsSection(_props, ref) {
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
