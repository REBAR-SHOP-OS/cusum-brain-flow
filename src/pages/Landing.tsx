import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, BarChart3, Truck, Factory, Brain, Calculator, Users, Shield } from "lucide-react";
import logoCoin from "@/assets/logo-coin.png";
import brainHero from "@/assets/brain-hero.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border" role="banner">
        <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between" aria-label="Main navigation">
          <div className="flex items-center gap-2">
            <img src={logoCoin} alt="REBAR SHOP OS logo" className="w-8 h-8 rounded-lg" width={32} height={32} />
            <span className="text-xl font-bold text-foreground">REBAR SHOP OS</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/signup">
              <Button>Get Started <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative py-20 px-6 overflow-hidden" aria-label="Hero">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <img 
              src={brainHero} 
              alt="" 
              className="w-full h-full object-cover opacity-[0.15]" 
              loading="lazy"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />
          </div>
          <div className="relative max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              AI-Powered Rebar Fabrication & Shop Management Software
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              REBAR SHOP OS streamlines rebar estimating, shop floor production, delivery tracking,
              sales pipeline, and accounting — all powered by AI agents built for reinforcing steel contractors.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg">Start Free <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </Link>
              <a href="https://rebar.shop" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline">Visit Rebar.shop</Button>
              </a>
            </div>
          </div>
        </section>

        {/* Core Features */}
        <section className="py-16 px-6 bg-muted/30" aria-label="Features">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-foreground text-center mb-4">
              Everything Rebar Fabricators Need to Operate
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              From takeoff to delivery — manage your entire rebar shop with AI-powered agents
              that follow CSA G30.18 and RSIC standards.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <FeatureCard 
                icon={<Calculator className="w-6 h-6" />}
                title="AI Rebar Estimating"
                description="Upload drawings (PDF/DWG) and get precise takeoffs using CSA G30.18 standards and the Changy Method."
              />
              <FeatureCard 
                icon={<Factory className="w-6 h-6" />}
                title="Shop Floor Tracking"
                description="Real-time machine monitoring, cut plans, bending queues, and production status for your entire floor."
              />
              <FeatureCard 
                icon={<Truck className="w-6 h-6" />}
                title="Delivery Management"
                description="Schedule routes, track drivers, capture proof-of-delivery signatures, and manage dispatch."
              />
              <FeatureCard 
                icon={<BarChart3 className="w-6 h-6" />}
                title="Sales Pipeline & CRM"
                description="Track leads, quotes, and deals with AI follow-up reminders. Never lose a rebar bid again."
              />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
              <FeatureCard 
                icon={<Mail className="w-6 h-6" />}
                title="Unified Inbox"
                description="Email, phone calls, and SMS in one place. AI summarizes conversations and extracts action items."
              />
              <FeatureCard 
                icon={<Brain className="w-6 h-6" />}
                title="AI Agent Team"
                description="9 specialized AI agents for sales, accounting, estimating, support, social media, and more."
              />
              <FeatureCard 
                icon={<Users className="w-6 h-6" />}
                title="Team Accountability"
                description="Daily briefings, KPI tracking, and automated follow-up reminders for every team member."
              />
              <FeatureCard 
                icon={<Shield className="w-6 h-6" />}
                title="QuickBooks Integration"
                description="Sync invoices, track AR aging, and manage collections — all connected to your accounting."
              />
            </div>
          </div>
        </section>

        {/* Industries / Use Cases */}
        <section className="py-16 px-6" aria-label="Use cases">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Built for Reinforcing Steel Contractors in Ontario
            </h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Whether you're a rebar fabricator, steel detailer, or construction supplier — REBAR SHOP OS
              connects with Gmail, Google Calendar, QuickBooks, RingCentral, and more to keep your
              entire operation running smoothly.
            </p>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="p-5 rounded-lg border border-border bg-card">
                <h3 className="font-semibold text-foreground mb-2">Rebar Fabricators</h3>
                <p className="text-sm text-muted-foreground">
                  Manage cut plans, bending schedules, inventory, and machine queues from one dashboard.
                </p>
              </div>
              <div className="p-5 rounded-lg border border-border bg-card">
                <h3 className="font-semibold text-foreground mb-2">Steel Detailers</h3>
                <p className="text-sm text-muted-foreground">
                  Upload structural drawings and get AI-powered rebar takeoffs following RSIC 2018 standards.
                </p>
              </div>
              <div className="p-5 rounded-lg border border-border bg-card">
                <h3 className="font-semibold text-foreground mb-2">Construction Suppliers</h3>
                <p className="text-sm text-muted-foreground">
                  Track orders, manage deliveries, and keep customers informed with real-time status updates.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6" role="contentinfo">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={logoCoin} alt="REBAR SHOP OS" className="w-6 h-6 rounded" width={24} height={24} />
            <span className="font-semibold text-foreground">REBAR SHOP OS</span>
            <span className="text-xs text-muted-foreground ml-2">by <a href="https://rebar.shop" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors underline">Rebar.shop</a></span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground" aria-label="Footer navigation">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          </nav>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Rebar.shop – Ontario Steel Detailing. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <article className="p-6 rounded-lg border border-border bg-card">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4" aria-hidden="true">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </article>
  );
}