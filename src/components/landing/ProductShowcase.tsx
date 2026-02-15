import { Package, Wrench, CircleDot, ArrowDownToLine, Layers, ExternalLink } from "lucide-react";

const CATEGORIES = [
  { name: "Express Rebar Fabrication", count: 65, icon: <Package className="w-6 h-6" />, url: "https://rebar.shop/product-category/express-rebar-fabrication/" },
  { name: "Rebar Accessories", count: 6, icon: <Wrench className="w-6 h-6" />, url: "https://rebar.shop/product-category/rebar-accessories/" },
  { name: "Rebar Cages", count: 4, icon: <Layers className="w-6 h-6" />, url: "https://rebar.shop/product-category/rebar-cages/" },
  { name: "Rebar Dowels", count: 3, icon: <ArrowDownToLine className="w-6 h-6" />, url: "https://rebar.shop/product-category/rebar-dowels/" },
  { name: "Fiberglass GFRP", count: 5, icon: <CircleDot className="w-6 h-6" />, url: "https://rebar.shop/product-category/fiberglass-gfrp-rebar/" },
  { name: "Stirrups", count: 12, icon: <CircleDot className="w-6 h-6" />, url: "https://rebar.shop/product-category/stirrups/" },
];

export function ProductShowcase() {
  return (
    <section className="py-20 px-6" aria-label="Product catalog">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-foreground text-center mb-4">Shop Rebar Products</h2>
        <p className="text-muted-foreground text-center mb-14 max-w-2xl mx-auto">
          Browse 95+ products across 6 categories — fabricated to CSA G40.21 Grade 400W standards with same-day availability on express items.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORIES.map((c) => (
            <a
              key={c.name}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group p-6 rounded-xl border border-border bg-card hover:shadow-lg transition-shadow flex items-start gap-4"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0" aria-hidden="true">
                {c.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{c.name}</h3>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
                <span className="inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {c.count} products
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
