import { Factory, Calculator, PenTool, HardHat, Truck, HeadphonesIcon, ExternalLink } from "lucide-react";

const SERVICES = [
  { title: "Rebar Fabrication", desc: "Custom cut & bent rebar to spec. Same-day turnaround on express orders with CSA G40.21 Grade 400W compliance.", icon: <Factory className="w-6 h-6" />, url: "https://rebar.shop/rebar-fabrication/" },
  { title: "Estimating Services", desc: "Accurate rebar takeoffs from structural drawings using the Changy Method and CSA G30.18 standards.", icon: <Calculator className="w-6 h-6" />, url: "https://rebar.shop/rebar-estimating/" },
  { title: "Detailing & Shop Drawings", desc: "Professional rebar detailing and shop drawings prepared by experienced steel detailers.", icon: <PenTool className="w-6 h-6" />, url: "https://rebar.shop/rebar-detailing-shop-drawings/" },
  { title: "Assembly & Installation", desc: "On-site rebar assembly and installation services for residential and commercial projects.", icon: <HardHat className="w-6 h-6" />, url: "https://rebar.shop/rebar-assembly-installation/" },
  { title: "Transportation & Delivery", desc: "Reliable rebar delivery across the GTA with real-time tracking and proof-of-delivery.", icon: <Truck className="w-6 h-6" />, url: "https://rebar.shop/rebar-transportation/" },
  { title: "Sales & Support", desc: "Dedicated account managers to help with quotes, orders, and technical questions.", icon: <HeadphonesIcon className="w-6 h-6" />, url: "https://rebar.shop/sales-service-support/" },
];

export function ServicesGrid() {
  return (
    <section className="py-20 px-6 bg-muted/30" aria-label="Services">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-foreground text-center mb-4">Full-Service Rebar Solutions</h2>
        <p className="text-muted-foreground text-center mb-14 max-w-2xl mx-auto">
          From estimating to delivery — everything your project needs under one roof.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {SERVICES.map((s) => (
            <a
              key={s.title}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group p-7 rounded-xl border border-border bg-card hover:shadow-lg transition-shadow"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-5" aria-hidden="true">
                {s.icon}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">{s.title}</h3>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
