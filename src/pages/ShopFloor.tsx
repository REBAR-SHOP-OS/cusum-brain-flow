import { Link } from "react-router-dom";
import { 
  Factory, 
  LayoutGrid, 
  ShieldCheck, 
  Send, 
  PackageCheck,
  ArrowLeft
} from "lucide-react";
import { MyJobsCard } from "@/components/shopfloor/MyJobsCard";
import { VoiceRecorderWidget } from "@/components/shopfloor/VoiceRecorderWidget";


interface HubCard {
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
  to: string;
  state?: Record<string, any>;
}

const hubCards: HubCard[] = [
  {
    label: "OFFICE",
    icon: <LayoutGrid className="w-7 h-7" />,
    to: "/office",
  },
  {
    label: "MATERIAL POOL",
    subtitle: "STAGING & FLOW",
    icon: <Factory className="w-7 h-7" />,
    to: "/shopfloor/pool",
  },
  {
    label: "SHOP FLOOR",
    subtitle: "MACHINES & STATIONS",
    icon: <Factory className="w-7 h-7" />,
    to: "/shopfloor/station",
  },
  {
    label: "CLEARANCE",
    subtitle: "QC & EVIDENCE",
    icon: <ShieldCheck className="w-7 h-7" />,
    to: "/shopfloor/clearance",
  },
  {
    label: "LOADING ST.",
    subtitle: "LOAD & EVIDENCE",
    icon: <PackageCheck className="w-7 h-7" />,
    to: "/shopfloor/loading",
  },
  {
    label: "DELIVERY",
    subtitle: "DISPATCH & LOADING",
    icon: <Send className="w-7 h-7" />,
    to: "/deliveries",
  },
  {
    label: "PICKUP ST.",
    subtitle: "CUSTOMER COLLECTION",
    icon: <PackageCheck className="w-7 h-7" />,
    to: "/shopfloor/pickup",
  },
];

export default function ShopFloor() {
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
        {/* Title */}
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
          {hubCards.map((card) => (
            <Link
              key={card.label}
              to={card.to}
              state={card.state}
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

        {/* Back link */}
        <Link
          to="/home"
          className="mt-12 flex items-center gap-2 text-xs tracking-widest text-muted-foreground hover:text-foreground transition-colors uppercase"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Entry Screen
        </Link>
      </div>

      {/* Voice Recorder Widget */}
      <VoiceRecorderWidget />
    </div>
  );
}
