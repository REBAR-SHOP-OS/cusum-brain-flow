import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, BarChart3, Truck, Factory, Brain, Calculator, Users, Shield, CheckCircle2 } from "lucide-react";
import { AnimatedCounter } from "@/components/ceo/AnimatedCounter";
import logoCoin from "@/assets/logo-coin.png";
import { InteractiveBrainBg } from "@/components/brain/InteractiveBrainBg";

const STATS = [
  { value: 10000, suffix: "+", label: "Tons Processed", prefix: "" },
  { value: 500, suffix: "+", label: "Projects Delivered", prefix: "" },
  { value: 99.2, suffix: "%", label: "Uptime", prefix: "", decimals: 1 },
  { value: 17, suffix: "", label: "AI Agents", prefix: "" },
];

const FEATURES = [
  { icon: <Calculator className="w-7 h-7" />, title: "AI Rebar Estimating", description: "Upload drawings (PDF/DWG) and get precise takeoffs using CSA G30.18 standards and the Changy Method." },
  { icon: <Factory className="w-7 h-7" />, title: "Shop Floor Tracking", description: "Real-time machine monitoring, cut plans, bending queues, and production status for your entire floor." },
  { icon: <Truck className="w-7 h-7" />, title: "Delivery Management", description: "Schedule routes, track drivers, capture proof-of-delivery signatures, and manage dispatch." },
  { icon: <BarChart3 className="w-7 h-7" />, title: "Sales Pipeline & CRM", description: "Track leads, quotes, and deals with AI follow-up reminders. Never lose a rebar bid again." },
  { icon: <Mail className="w-7 h-7" />, title: "AI-Powered Inbox", description: "Email, calls, and SMS unified. AI summarizes conversations, drafts replies, and extracts action items." },
  { icon: <Brain className="w-7 h-7" />, title: "AI Agent Team", description: "Specialized AI agents for sales, accounting, estimating, support, social media, and more." },
];

const STEPS = [
  { num: "01", title: "Sign Up", description: "Create your account in 60 seconds. No credit card required." },
  { num: "02", title: "Configure", description: "Connect Gmail, QuickBooks, and set up your machines and team." },
  { num: "03", title: "Operate", description: "AI agents start working. Track production, manage bids, and deliver." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur" role="banner">
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
        <section className="relative py-24 md:py-32 px-6 overflow-hidden" aria-label="Hero">
          <InteractiveBrainBg />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/80 pointer-events-none" />
          <div className="relative z-10 max-w-5xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold text-foreground mb-6 leading-tight tracking-tight">
              AI-Powered Rebar Fabrication<br className="hidden md:block" /> & Shop Management
            </h1>
            <p className="text-lg md:text-xl text-foreground/80 mb-10 max-w-2xl mx-auto">
              From takeoff to delivery — streamline estimating, production, sales, and accounting
              with AI agents built for reinforcing steel contractors.
            </p>
            <div className="flex items-center justify-center gap-4 mb-16">
              <Link to="/signup">
                <Button size="lg" className="text-base px-8">Start Free <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </Link>
              <a href="https://rebar.shop" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="text-base px-8">Visit Rebar.shop</Button>
              </a>
            </div>

            {/* Animated Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-primary">
                    <AnimatedCounter value={s.value} prefix={s.prefix} suffix={s.suffix} decimals={s.decimals || 0} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-20 px-6 bg-muted/30" aria-label="Features">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground text-center mb-4">
              Everything Rebar Fabricators Need
            </h2>
            <p className="text-muted-foreground text-center mb-14 max-w-2xl mx-auto">
              Six integrated modules powered by AI agents that follow CSA G30.18 and RSIC standards.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {FEATURES.map((f) => (
                <article key={f.title} className="p-7 rounded-xl border border-border bg-card hover:shadow-lg transition-shadow">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-5" aria-hidden="true">
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Mid-page CTA */}
        <section className="py-16 px-6 bg-primary/5" aria-label="Call to action">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">Ready to modernize your rebar shop?</h2>
            <p className="text-muted-foreground mb-8">Join fabricators across Ontario using AI to cut waste, speed up production, and win more bids.</p>
            <Link to="/signup">
              <Button size="lg" className="text-base px-10">Get Started Free <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </Link>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-6" aria-label="How it works">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground text-center mb-14">
              Up and Running in 3 Steps
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {STEPS.map((s) => (
                <div key={s.num} className="text-center">
                  <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-5">
                    {s.num}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust / Standards */}
        <section className="py-16 px-6 bg-muted/30" aria-label="Trust">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-foreground mb-8">Built for Canadian Steel Standards</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                "CSA G30.18 Compliant",
                "RSIC 2018 Standards",
                "QuickBooks Integration",
                "Gmail & Calendar Sync",
              ].map((badge) => (
                <div key={badge} className="flex items-center gap-2 justify-center p-4 rounded-lg border border-border bg-card">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground">{badge}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-16 px-6" aria-label="Use cases">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Built for Reinforcing Steel Contractors in Ontario
            </h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Whether you're a rebar fabricator, steel detailer, or construction supplier.
            </p>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              {[
                { title: "Rebar Fabricators", desc: "Manage cut plans, bending schedules, inventory, and machine queues from one dashboard." },
                { title: "Steel Detailers", desc: "Upload structural drawings and get AI-powered rebar takeoffs following RSIC 2018 standards." },
                { title: "Construction Suppliers", desc: "Track orders, manage deliveries, and keep customers informed with real-time status updates." },
              ].map((c) => (
                <div key={c.title} className="p-6 rounded-xl border border-border bg-card">
                  <h3 className="font-semibold text-foreground mb-2">{c.title}</h3>
                  <p className="text-sm text-muted-foreground">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-20 px-6 bg-primary/5" aria-label="Final call to action">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">Start Building Smarter Today</h2>
            <p className="text-muted-foreground mb-8">No credit card required. Set up in under 5 minutes.</p>
            <div className="flex items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg" className="text-base px-10">Create Free Account <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="text-base px-8">Sign In</Button>
              </Link>
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
