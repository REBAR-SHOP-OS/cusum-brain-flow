import { Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    quote: "We cut estimating time by 70% and haven't missed a bid deadline since switching to Rebar Shop OS.",
    name: "Marco D.",
    role: "Owner, GTA Rebar Fabricators",
  },
  {
    quote: "The AI agents handle our inbox and follow-ups automatically. It's like having three extra staff without the overhead.",
    name: "Sarah K.",
    role: "Operations Manager, SteelLine Inc.",
  },
  {
    quote: "Shop floor tracking finally gives us real-time visibility. Our delivery accuracy went from 88% to 99%.",
    name: "James T.",
    role: "Plant Supervisor, Ontario Reinforcing",
  },
];

export function TestimonialSection() {
  return (
    <section className="py-20 px-6" aria-label="Testimonials">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-foreground text-center mb-4">
          Trusted by Fabricators Across Ontario
        </h2>
        <p className="text-muted-foreground text-center mb-14 max-w-2xl mx-auto">
          See why reinforcing steel contractors are switching to AI-powered shop management.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t) => (
            <article
              key={t.name}
              className="p-7 rounded-xl border border-border bg-card flex flex-col"
            >
              <Quote className="w-8 h-8 text-primary/30 mb-4 shrink-0" aria-hidden="true" />
              <blockquote className="text-sm text-foreground/90 leading-relaxed flex-1 mb-5">
                "{t.quote}"
              </blockquote>
              <footer className="border-t border-border pt-4">
                <p className="font-semibold text-foreground text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
