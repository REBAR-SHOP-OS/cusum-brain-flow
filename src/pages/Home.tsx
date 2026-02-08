import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChatInput } from "@/components/chat/ChatInput";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AutomationsSection } from "@/components/integrations/AutomationsSection";
import { 
  TrendingUp, 
  FileText, 
  Truck, 
  Mail,
  ChevronRight 
} from "lucide-react";
import logoCoin from "@/assets/logo-coin.png";

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

interface Helper {
  id: string;
  name: string;
  role: string;
  image: string;
  gradient: string;
  route: string;
}

const helpers: Helper[] = [
  {
    id: "sales",
    name: "Blitz",
    role: "Sales & Pipeline",
    image: salesHelper,
    gradient: "from-blue-500 to-blue-600",
    route: "/agent/sales",
  },
  {
    id: "support",
    name: "Haven",
    role: "Customer Support",
    image: supportHelper,
    gradient: "from-purple-500 to-purple-600",
    route: "/agent/support",
  },
  {
    id: "accounting",
    name: "Tally",
    role: "Accounting",
    image: accountingHelper,
    gradient: "from-green-500 to-green-600",
    route: "/agent/accounting",
  },
  {
    id: "estimating",
    name: "Gauge",
    role: "Estimating",
    image: estimatingHelper,
    gradient: "from-orange-500 to-orange-600",
    route: "/agent/estimating",
  },
  {
    id: "shopfloor",
    name: "Forge",
    role: "Shop Floor",
    image: shopfloorHelper,
    gradient: "from-slate-500 to-slate-600",
    route: "/agent/shopfloor",
  },
  {
    id: "delivery",
    name: "Atlas",
    role: "Deliveries",
    image: deliveryHelper,
    gradient: "from-yellow-500 to-yellow-600",
    route: "/agent/delivery",
  },
  {
    id: "email",
    name: "Relay",
    role: "Email & Inbox",
    image: emailHelper,
    gradient: "from-pink-500 to-pink-600",
    route: "/agent/email",
  },
  {
    id: "social",
    name: "Pixel",
    role: "Social Media",
    image: socialHelper,
    gradient: "from-purple-500 to-pink-500",
    route: "/agent/social",
  },
  {
    id: "data",
    name: "Prism",
    role: "Data & Insights",
    image: dataHelper,
    gradient: "from-teal-500 to-teal-600",
    route: "/agent/data",
  },
  {
    id: "bizdev",
    name: "Buddy",
    role: "Business Development",
    image: bizdevHelper,
    gradient: "from-blue-600 to-indigo-600",
    route: "/agent/bizdev",
  },
  {
    id: "webbuilder",
    name: "Commet",
    role: "Web Builder",
    image: webbuilderHelper,
    gradient: "from-orange-500 to-red-500",
    route: "/agent/webbuilder",
  },
  {
    id: "assistant",
    name: "Vizzy",
    role: "Virtual Assistant",
    image: assistantHelper,
    gradient: "from-yellow-400 to-amber-500",
    route: "/agent/assistant",
  },
  {
    id: "copywriting",
    name: "Penn",
    role: "Copywriting",
    image: copywritingHelper,
    gradient: "from-emerald-500 to-teal-500",
    route: "/agent/copywriting",
  },
  {
    id: "talent",
    name: "Scouty",
    role: "Talent & HR",
    image: talentHelper,
    gradient: "from-cyan-400 to-cyan-600",
    route: "/agent/talent",
  },
  {
    id: "seo",
    name: "Seomi",
    role: "SEO & Search",
    image: seoHelper,
    gradient: "from-lime-500 to-green-600",
    route: "/agent/seo",
  },
  {
    id: "growth",
    name: "Gigi",
    role: "Personal Development",
    image: growthHelper,
    gradient: "from-green-400 to-emerald-600",
    route: "/agent/growth",
  },
];

interface UseCase {
  title: string;
  icon: React.ElementType;
  category: string;
  route: string;
  prompt: string;
}

const useCases: UseCase[] = [
  {
    title: "Check my pipeline status",
    icon: TrendingUp,
    category: "Sales",
    route: "/agent/sales",
    prompt: "Check my pipeline status. Show me a summary of active leads, their stages, and expected close dates.",
  },
  {
    title: "Create a quote for a customer",
    icon: FileText,
    category: "Estimating",
    route: "/agent/estimating",
    prompt: "Help me create a new quote for a customer. Walk me through the process step by step.",
  },
  {
    title: "Track today's deliveries",
    icon: Truck,
    category: "Operations",
    route: "/agent/delivery",
    prompt: "Show me today's delivery schedule. What's the status of all active deliveries?",
  },
  {
    title: "Summarize today's emails",
    icon: Mail,
    category: "Productivity",
    route: "/agent/email",
    prompt: "Summarize today's emails. Highlight anything urgent or requiring my attention.",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");

  const handleSend = useCallback((content: string) => {
    navigate("/inbox-manager", { state: { initialMessage: content } });
  }, [navigate]);

  const handleHelperClick = (helper: Helper) => {
    navigate(helper.route);
  };

  const handleUseCaseClick = (useCase: UseCase) => {
    navigate(useCase.route, { state: { initialMessage: useCase.prompt } });
  };

  return (
    <ScrollArea className="h-full">
      <div className="relative flex flex-col items-center px-6 py-8 max-w-6xl mx-auto">
        {/* Big logo background */}
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
          <img 
            src={logoCoin} 
            alt="" 
            className="w-[600px] h-[600px] opacity-[0.04]" 
          />
        </div>

        {/* Hero Section */}
        <div className="relative z-10 w-full max-w-2xl text-center mb-12">
          <h1 className="text-3xl font-bold mb-2">
            How can REBAR SHOP OS help you today?
          </h1>
          <p className="text-muted-foreground mb-8">
            Your AI-powered operations assistant
          </p>
          
          <div className="w-full">
            <ChatInput
              onSend={handleSend}
              placeholder="Ask anything about your business..."
              disabled={false}
            />
          </div>
        </div>

        {/* Use Cases Section */}
        <div className="relative z-10 w-full mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {useCases.map((useCase) => (
              <Card
                key={useCase.title}
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors group"
                onClick={() => handleUseCaseClick(useCase)}
              >
                <p className="font-medium mb-3 line-clamp-2">{useCase.title}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <useCase.icon className="w-4 h-4" />
                    <span>{useCase.category}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Automations Section */}
        <div className="relative z-10 w-full mb-12">
          <AutomationsSection />
        </div>

        {/* Helpers Section */}
        <div className="relative z-10 w-full">
          <h2 className="text-lg font-semibold mb-4">Your Helpers</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {helpers.map((helper) => (
              <HelperCard
                key={helper.id}
                helper={helper}
                onClick={() => handleHelperClick(helper)}
              />
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function HelperCard({ helper, onClick }: { helper: Helper; onClick: () => void }) {
  return (
    <Card
      className="overflow-hidden cursor-pointer group hover:scale-[1.03] transition-transform duration-150 ease-out"
      onClick={onClick}
    >
      <div className="relative aspect-[4/5]">
        <img
          src={helper.image}
          alt={helper.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-none p-3">
          <h3 className="font-bold text-lg leading-tight text-white">{helper.name}</h3>
          <p className="text-sm text-white/80">{helper.role}</p>
        </div>
      </div>
    </Card>
  );
}
