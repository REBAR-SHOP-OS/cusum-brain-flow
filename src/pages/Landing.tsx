import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, BarChart3, Truck, Factory, Brain } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
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
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            REBAR SHOP OS - AI-Powered Operations Management
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            REBAR SHOP OS streamlines your business operations by integrating email, sales pipeline, 
            shop floor management, and deliveries into one intelligent platform.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg">Start Free <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-12">
            Everything you need to run your operations
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard 
              icon={<Mail className="w-6 h-6" />}
              title="Unified Inbox"
              description="Manage all customer communications from email and phone in one place."
            />
            <FeatureCard 
              icon={<BarChart3 className="w-6 h-6" />}
              title="Sales Pipeline"
              description="Track leads, quotes, and deals with AI-assisted follow-ups."
            />
            <FeatureCard 
              icon={<Factory className="w-6 h-6" />}
              title="Shop Floor"
              description="Monitor production, work orders, and manufacturing status in real-time."
            />
            <FeatureCard 
              icon={<Truck className="w-6 h-6" />}
              title="Deliveries"
              description="Schedule, track, and optimize delivery routes efficiently."
            />
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Connects with your existing tools
          </h2>
          <p className="text-muted-foreground mb-8">
            Seamlessly integrates with Gmail, Google Calendar, QuickBooks, and more to 
            keep your data synchronized across all platforms.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <Brain className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">REBAR SHOP OS</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="https://cusum-brain-flow.lovable.app/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            <a href="https://cusum-brain-flow.lovable.app/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </a>
          </nav>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} REBAR SHOP OS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-lg border border-border bg-card">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
