import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bot, Mail, FileText, MessageCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  color: "purple" | "blue" | "gold" | "teal";
  icon: "social" | "inbox" | "summary" | "comment";
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
    beta: true,
    route: "/social-media-manager",
  },
  {
    id: "inbox-manager",
    name: "Inbox Manager",
    description: "Organize and prioritize incoming emails",
    enabled: true,
    color: "blue",
    icon: "inbox",
    beta: true,
    route: "/inbox-manager",
  },
  {
    id: "daily-summarizer",
    name: "Daily Summarizer",
    description: "Get daily digests of key activities",
    enabled: true,
    color: "gold",
    icon: "summary",
    beta: true,
    route: "/daily-summarizer",
  },
  {
    id: "facebook-commenter",
    name: "Facebook Commenter",
    description: "Auto-respond to comments and messages",
    enabled: true,
    color: "blue",
    icon: "comment",
    beta: true,
  },
];

const colorGradients = {
  purple: "bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500",
  blue: "bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500",
  gold: "bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-400",
  teal: "bg-gradient-to-br from-teal-500 via-emerald-500 to-green-400",
};

const iconComponents = {
  social: Sparkles,
  inbox: Mail,
  summary: FileText,
  comment: MessageCircle,
};

interface AutomationCardProps {
  automation: Automation;
  onToggle: (id: string, enabled: boolean) => void;
  onClick?: () => void;
}

function AutomationCard({ automation, onToggle, onClick }: AutomationCardProps) {
  const Icon = iconComponents[automation.icon];

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 text-white transition-transform hover:scale-[1.02] cursor-pointer",
        colorGradients[automation.color]
      )}
    >
      {/* Content */}
      <div className="relative z-10">
        <h3 className="text-xl font-bold leading-tight mb-1">
          {automation.name.split(" ").map((word, i) => (
            <span key={i} className="block">
              {word}
            </span>
          ))}
        </h3>
        <p className="text-sm text-white/70 mb-4">{automation.description}</p>

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
        <Icon className="w-24 h-24" strokeWidth={1} />
      </div>

      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
    </div>
  );
}

export function AutomationsSection() {
  const navigate = useNavigate();
  const [automations, setAutomations] = useState(defaultAutomations);

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
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Automations</h2>
        <Badge variant="outline" className="text-xs">
          AI-Powered
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {automations.map((automation) => (
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
}
