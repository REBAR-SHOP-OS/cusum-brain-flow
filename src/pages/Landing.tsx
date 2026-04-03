import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertTriangle, Brain, Cpu, Database, BarChart3, Layers, Eye, Gauge, ServerCog, Tablet, Radio, Cloud, Cog, ChevronRight, Check, X } from "lucide-react";
import { AnimatedCounter } from "@/components/ceo/AnimatedCounter";
import logoCoin from "@/assets/logo-coin.png";
import { InteractiveBrainBg } from "@/components/brain/InteractiveBrainBg";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { InteractiveSalesConcierge } from "@/components/landing/InteractiveSalesConcierge";
import { LandingSectionBoundary } from "@/components/landing/LandingSectionBoundary";
import { Skeleton } from "@/components/ui/skeleton";

const STATS = [
  { value: 30, suffix: "%", label: "Waste Reduction", prefix: "" },
  { value: 99, suffix: "%", label: "Count Accuracy", prefix: "" },
  { value: 4, suffix: "", label: "Core Modules", prefix: "" },
  { value: 100, suffix: "%", label: "Odoo-Ready", prefix: "" },
];

const PROBLEMS = [
  { icon: <AlertTriangle className="w-5 h-5" />, title: "10–25% Material Waste", desc: "Steel lost to inefficient cutting patterns and ignored leftover stock." },
  { icon: <AlertTriangle className="w-5 h-5" />, title: "Cutter/Bender Loops", desc: "Overproduction from manual counting and uncontrolled feed cycles." },
  { icon: <AlertTriangle className="w-5 h-5" />, title: "Manual Counting Errors", desc: "Human miscounts lead to short shipments and costly rework." },
  { icon: <AlertTriangle className="w-5 h-5" />, title: "No Structured Waste Bank", desc: "Leftover bars pile up with no tracking, tagging, or reuse system." },
  { icon: <AlertTriangle className="w-5 h-5" />, title: "Poor Inventory Visibility", desc: "No real-time view of raw stock, WIP, or waste across the shop floor." },
  { icon: <AlertTriangle className="w-5 h-5" />, title: "No Production Intelligence", desc: "Decisions based on memory, not data. No KPIs, no anomaly detection." },
];

const MODULES = [
  {
    icon: <Brain className="w-7 h-7" />,
    title: "AI Waste Optimization Engine",
    desc: "System-level optimization that reads your Waste Bank in real-time, prioritizes leftover usage, predicts future demand, and minimizes total long-term waste — not just per-order scrap.",
    steps: ["Consume Waste Bank pieces first", "Use full bars only if necessary", "Minimize residual length"],
  },
  {
    icon: <Cpu className="w-7 h-7" />,
    title: "Loop Control System",
    desc: "Hardware + software hybrid with exit sensors, smart feed controllers, and AI anomaly detection. The bender becomes the master count controller — feed auto-stops at target quantity.",
    steps: ["Photoelectric exit counter", "Smart feed auto-stop", "Double-feed & miscount detection"],
  },
  {
    icon: <Database className="w-7 h-7" />,
    title: "Digital Waste Bank",
    desc: "Every leftover bar is measured, tagged, and registered into a searchable digital inventory. Waste classified by diameter, length class, and material type. Each rack is a digital location.",
    steps: ["Auto-classify by size & grade", "Digital rack locations", "Searchable leftover inventory"],
  },
  {
    icon: <BarChart3 className="w-7 h-7" />,
    title: "Production Intelligence Dashboard",
    desc: "Real-time KPIs, production analytics, and operational intelligence. Connect production directly to ERP with automatic stock movements and waste-to-stock conversion.",
    steps: ["Real-time production KPIs", "ERP auto-sync (Odoo-ready)", "Anomaly & trend detection"],
  },
];

const PHASES = [
  { num: "01", title: "Deploy", desc: "Install edge sensors, controllers, and tablet interfaces. Connect to your ERP. Go live in days, not months." },
  { num: "02", title: "Optimize", desc: "AI learns your production patterns, builds your Digital Waste Bank, and starts eliminating waste from day one." },
  { num: "03", title: "Scale", desc: "Expand to multi-site dashboards, predictive demand forecasting, and AI-driven procurement optimization." },
];

const COMPETITORS = [
  { name: "Machine Manufacturers", focus: "Hardware only", has: ["Machines", "Basic counters"], missing: ["AI optimization", "Waste Bank", "Production intelligence"] },
  { name: "ERP Vendors", focus: "Accounting only", has: ["Invoicing", "Stock ledger"], missing: ["Shop floor control", "Cut optimization", "Real-time sensors"] },
  { name: "Optimization Software", focus: "Cut-plans only", has: ["Nesting algorithms", "Order-level optimization"], missing: ["Waste Bank integration", "Loop control", "System-level AI"] },
];

const TIERS = [
  { name: "Tier 1", title: "Optimization Only", price: "Contact us", features: ["AI cut optimization", "Waste Bank reads", "Basic analytics", "Email support"] },
  { name: "Tier 2", title: "Optimization + Waste Bank", price: "Contact us", features: ["Everything in Tier 1", "Digital Waste Bank", "Rack management", "ERP sync", "Priority support"], popular: true },
  { name: "Tier 3", title: "Full AI Production Control", price: "Contact us", features: ["Everything in Tier 2", "Loop Control System", "Anomaly detection", "Multi-site dashboard", "Predictive forecasting", "Dedicated success manager"] },
];

export default function Landing() {
  const { user, loading } = useAuth();

  // Auth timeout: never block rendering for more than 3 seconds
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, [loading]);

  const isLoading = loading && !timedOut;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Skeleton header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="w-32 h-5" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="w-16 h-8 rounded-md" />
            <Skeleton className="w-28 h-8 rounded-md" />
          </div>
        </div>
        {/* Skeleton hero */}
        <div className="max-w-5xl mx-auto text-center py-24 px-6 space-y-6">
          <Skeleton className="w-48 h-6 mx-auto rounded-full" />
          <Skeleton className="w-full max-w-lg h-12 mx-auto" />
          <Skeleton className="w-full max-w-md h-6 mx-auto" />
          <div className="flex justify-center gap-4 pt-4">
            <Skeleton className="w-36 h-10 rounded-md" />
            <Skeleton className="w-36 h-10 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur" role="banner">
        <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between" aria-label="Main navigation">
          <div className="flex items-center gap-2">
            <img src={logoCoin} alt="REBAR SHOP OS logo" className="w-8 h-8 rounded-lg" width={32} height={32} />
            <span className="text-xl font-bold text-foreground">REBAR SHOP OS</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Request Pilot <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative py-24 md:py-32 px-6 overflow-hidden" aria-label="Hero">
          <LandingSectionBoundary section="InteractiveBrainBg" fallback={<div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/10" />}>
            <InteractiveBrainBg />
          </LandingSectionBoundary>
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/80 pointer-events-none" />
          <div className="relative z-10 max-w-5xl mx-auto text-center">
            <span className="inline-block mb-4 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold tracking-wide">
              Industrial AI for Rebar Manufacturing
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold text-foreground mb-6 leading-tight tracking-tight">
              The Industrial Brain<br className="hidden md:block" /> for Rebar Factories
            </h1>
            <p className="text-lg md:text-xl text-foreground/80 mb-10 max-w-2xl mx-auto">
              AI-powered production intelligence that eliminates waste, prevents errors, and turns workshops into data-driven smart factories.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
              <Link to="/signup">
                <Button size="lg" className="text-base px-8">Request a Pilot <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </Link>
              <a href="https://rebar.shop" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="text-base px-8">Watch Demo</Button>
              </a>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-primary">
                    <LandingSectionBoundary section="AnimatedCounter" fallback={<span>{s.prefix}{s.value}{s.suffix}</span>}>
                      <AnimatedCounter value={s.value} prefix={s.prefix} suffix={s.suffix} decimals={0} />
                    </LandingSectionBoundary>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="py-20 px-6 bg-destructive/5" aria-label="Problem">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground text-center mb-4">The Hidden Cost of Manual Production</h2>
            <p className="text-muted-foreground text-center mb-14 max-w-2xl mx-auto">
              Most rebar factories run on manual tracking, Excel, machine memory, and operator judgment. This creates hidden losses every day.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {PROBLEMS.map((p) => (
                <div key={p.title} className="p-6 rounded-xl border border-destructive/20 bg-card">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive mb-4" aria-hidden="true">{p.icon}</div>
                  <h3 className="font-semibold text-foreground mb-1">{p.title}</h3>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4 Core Modules */}
        <section className="py-20 px-6" aria-label="Core modules">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground text-center mb-4">4 Core Modules</h2>
            <p className="text-muted-foreground text-center mb-14 max-w-2xl mx-auto">
              A full production intelligence layer — not just software, not just hardware.
            </p>
            <div className="grid md:grid-cols-2 gap-8">
              {MODULES.map((m) => (
                <article key={m.title} className="p-7 rounded-xl border border-border bg-card hover:shadow-lg transition-shadow">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-5" aria-hidden="true">{m.icon}</div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{m.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{m.desc}</p>
                  <ul className="space-y-2">
                    {m.steps.map((step) => (
                      <li key={step} className="flex items-center gap-2 text-sm text-foreground/80">
                        <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                        {step}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-6 bg-muted/30" aria-label="How it works">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground text-center mb-14">Deploy → Optimize → Scale</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {PHASES.map((s) => (
                <div key={s.num} className="text-center">
                  <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-5">{s.num}</div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section className="py-20 px-6" aria-label="Architecture">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground text-center mb-4">Hardware + Software Architecture</h2>
            <p className="text-muted-foreground text-center mb-14 max-w-2xl mx-auto">Edge devices handle real-time machine signals. Cloud handles optimization and learning.</p>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="p-7 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3 mb-5">
                  <ServerCog className="w-6 h-6 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Edge Layer</h3>
                </div>
                <ul className="space-y-3">
                  {[
                    { icon: <Cpu className="w-4 h-4" />, text: "Industrial mini controller (edge device)" },
                    { icon: <Radio className="w-4 h-4" />, text: "Optical & photoelectric sensors" },
                    { icon: <Eye className="w-4 h-4" />, text: "Optional AI camera module" },
                    { icon: <Tablet className="w-4 h-4" />, text: "Tablet interface near machines" },
                  ].map((item) => (
                    <li key={item.text} className="flex items-center gap-3 text-sm text-foreground/80">
                      <span className="text-primary">{item.icon}</span>
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-7 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3 mb-5">
                  <Cloud className="w-6 h-6 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Cloud Layer</h3>
                </div>
                <ul className="space-y-3">
                  {[
                    { icon: <Brain className="w-4 h-4" />, text: "Cloud-based AI optimization engine" },
                    { icon: <Cog className="w-4 h-4" />, text: "Optimization service & demand prediction" },
                    { icon: <Database className="w-4 h-4" />, text: "Inventory intelligence module" },
                    { icon: <Gauge className="w-4 h-4" />, text: "Production analytics dashboard" },
                  ].map((item) => (
                    <li key={item.text} className="flex items-center gap-3 text-sm text-foreground/80">
                      <span className="text-primary">{item.icon}</span>
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Competitive Positioning */}
        <section className="py-20 px-6 bg-muted/30" aria-label="Competitive positioning">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground text-center mb-4">Why REBAR SHOP OS Is Different</h2>
            <p className="text-muted-foreground text-center mb-14 max-w-2xl mx-auto">No one else owns production intelligence for rebar factories.</p>
            <div className="grid md:grid-cols-3 gap-6 mb-10">
              {COMPETITORS.map((c) => (
                <div key={c.name} className="p-6 rounded-xl border border-border bg-card">
                  <h3 className="font-semibold text-foreground mb-1">{c.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4">{c.focus}</p>
                  <ul className="space-y-2 mb-3">
                    {c.has.map((h) => (
                      <li key={h} className="flex items-center gap-2 text-sm text-foreground/70">
                        <Check className="w-3.5 h-3.5 text-muted-foreground" />{h}
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-2">
                    {c.missing.map((m) => (
                      <li key={m} className="flex items-center gap-2 text-sm text-destructive/70">
                        <X className="w-3.5 h-3.5" />{m}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="p-6 rounded-xl border-2 border-primary bg-primary/5 text-center">
              <h3 className="text-lg font-bold text-primary mb-1">REBAR SHOP OS</h3>
              <p className="text-sm text-foreground/80">The operating system for rebar fabrication — full production intelligence.</p>
            </div>
          </div>
        </section>

        {/* Pricing Tiers */}
        <section className="py-20 px-6" aria-label="Pricing">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground text-center mb-4">SaaS + Hardware</h2>
            <p className="text-muted-foreground text-center mb-14 max-w-2xl mx-auto">One-time hardware kit + monthly subscription. ROI from day one.</p>
            <div className="grid md:grid-cols-3 gap-6">
              {TIERS.map((t) => (
                <div key={t.name} className={`p-7 rounded-xl border bg-card flex flex-col ${t.popular ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
                  {t.popular && <span className="inline-block mb-3 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold self-start">Most Popular</span>}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t.name}</p>
                  <h3 className="text-lg font-bold text-foreground mt-1 mb-4">{t.title}</h3>
                  <ul className="space-y-2 flex-1 mb-6">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />{f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup">
                    <Button variant={t.popular ? "default" : "outline"} className="w-full">{t.price}</Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Now CTA */}
        <section className="py-20 px-6 bg-primary/5" aria-label="Final call to action">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">Why Now?</h2>
            <p className="text-lg text-foreground/80 mb-3">AI + low-cost sensors + ERP APIs make industrial intelligence affordable for the first time.</p>
            <p className="text-muted-foreground mb-8">Material savings scale with steel price. Even 5% improvement is huge. The ROI is obvious and fast.</p>
            <div className="flex items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg" className="text-base px-10">Request a Pilot <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </Link>
              <a href="https://rebar.shop" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="text-base px-8">Watch Demo</Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
      <LandingSectionBoundary section="PublicChatWidget">
        <PublicChatWidget />
      </LandingSectionBoundary>
    </div>
  );
}
