import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChatInput } from "@/components/chat/ChatInput";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  TrendingUp, 
  FileText, 
  Truck, 
  Mail,
  ChevronRight 
} from "lucide-react";

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
    name: "Salesy",
    role: "Sales & Pipeline",
    image: salesHelper,
    gradient: "from-blue-500 to-blue-600",
    route: "/pipeline",
  },
  {
    id: "support",
    name: "Sasha",
    role: "Customer Support",
    image: supportHelper,
    gradient: "from-purple-500 to-purple-600",
    route: "/customers",
  },
  {
    id: "accounting",
    name: "Archie",
    role: "Accounting",
    image: accountingHelper,
    gradient: "from-green-500 to-green-600",
    route: "/tasks",
  },
  {
    id: "estimating",
    name: "Eddie",
    role: "Estimating",
    image: estimatingHelper,
    gradient: "from-orange-500 to-orange-600",
    route: "/tasks",
  },
  {
    id: "shopfloor",
    name: "Steely",
    role: "Shop Floor",
    image: shopfloorHelper,
    gradient: "from-slate-500 to-slate-600",
    route: "/shop-floor",
  },
  {
    id: "delivery",
    name: "Danny",
    role: "Deliveries",
    image: deliveryHelper,
    gradient: "from-yellow-500 to-yellow-600",
    route: "/deliveries",
  },
  {
    id: "email",
    name: "Emmy",
    role: "Email & Inbox",
    image: emailHelper,
    gradient: "from-pink-500 to-pink-600",
    route: "/inbox-manager",
  },
  {
    id: "social",
    name: "Sushie",
    role: "Social Media",
    image: socialHelper,
    gradient: "from-purple-500 to-pink-500",
    route: "/social-media-manager",
  },
  {
    id: "data",
    name: "Dexter",
    role: "Data & Insights",
    image: dataHelper,
    gradient: "from-teal-500 to-teal-600",
    route: "/brain",
  },
];

interface UseCase {
  title: string;
  icon: React.ElementType;
  category: string;
  route: string;
}

const useCases: UseCase[] = [
  {
    title: "Check my pipeline status",
    icon: TrendingUp,
    category: "Sales",
    route: "/pipeline",
  },
  {
    title: "Create a quote for a customer",
    icon: FileText,
    category: "Estimating",
    route: "/tasks",
  },
  {
    title: "Track today's deliveries",
    icon: Truck,
    category: "Operations",
    route: "/deliveries",
  },
  {
    title: "Summarize today's emails",
    icon: Mail,
    category: "Productivity",
    route: "/inbox-manager",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");

  const handleSend = useCallback((content: string) => {
    // Navigate to inbox with the message
    navigate("/inbox-manager", { state: { initialMessage: content } });
  }, [navigate]);

  const handleHelperClick = (helper: Helper) => {
    navigate(helper.route);
  };

  const handleUseCaseClick = (useCase: UseCase) => {
    navigate(useCase.route);
  };

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col items-center px-6 py-8 max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="w-full max-w-2xl text-center mb-12">
          <h1 className="text-3xl font-bold mb-2">
            How can REBAR SHOP OS help you today?
          </h1>
          <p className="text-muted-foreground mb-8">
            Your AI-powered operations assistant
          </p>
          
          {/* Chat Input */}
          <div className="w-full">
            <ChatInput
              onSend={handleSend}
              placeholder="Ask anything about your business..."
              disabled={false}
            />
          </div>
        </div>

        {/* Use Cases Section */}
        <div className="w-full mb-12">
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

        {/* Helpers Section */}
        <div className="w-full">
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
      className="overflow-hidden cursor-pointer group hover:scale-[1.02] transition-transform"
      onClick={onClick}
    >
      <div className="relative aspect-[4/5]">
        {/* Character Image */}
        <img
          src={helper.image}
          alt={helper.name}
          className="w-full h-full object-cover"
        />
        
        {/* Gradient Overlay */}
        <div className={`absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t ${helper.gradient} to-transparent`} />
        
        {/* Text Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <h3 className="font-bold text-lg leading-tight">{helper.name}</h3>
          <p className="text-sm opacity-90">{helper.role}</p>
        </div>
      </div>
    </Card>
  );
}
