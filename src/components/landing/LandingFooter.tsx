import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import logoCoin from "@/assets/logo-coin.png";

export function LandingFooter() {
  return (
    <footer className="border-t border-border py-10 px-6" role="contentinfo">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Row 1: Original footer content (preserved) */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={logoCoin} alt="REBAR SHOP OS" className="w-6 h-6 rounded" width={24} height={24} />
            <span className="font-semibold text-foreground">REBAR SHOP OS</span>
            <span className="text-xs text-muted-foreground ml-2">
              by{" "}
              <a href="https://rebar.shop" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors underline">
                Rebar.shop
              </a>
            </span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground" aria-label="Footer navigation">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          </nav>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Rebar.shop – Ontario Steel Detailing. All rights reserved.
          </p>
        </div>

        {/* Row 2: Business details (additive) */}
        <div className="border-t border-border pt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm text-muted-foreground">
          <address className="not-italic space-y-2">
            <p className="font-semibold text-foreground mb-2">Contact</p>
            <p className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <a href="tel:+16478869498" className="hover:text-foreground transition-colors">(647) 886-9498</a>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <a href="mailto:info@rebar.shop" className="hover:text-foreground transition-colors">info@rebar.shop</a>
            </p>
          </address>

          <div className="space-y-2">
            <p className="font-semibold text-foreground mb-2">Service Area</p>
            <p className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              Greater Toronto Area, Ontario, Canada
            </p>
            <p className="text-xs">Serving rebar fabricators &amp; steel detailers province-wide.</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-foreground mb-2">Quick Links</p>
            <div className="flex flex-col gap-1">
              <a href="https://rebar.shop/shop/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Products</a>
              <a href="https://rebar.shop/rebar-fabrication/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Fabrication</a>
              <a href="https://rebar.shop/rebar-estimating/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Estimating</a>
              <a href="https://rebar.shop/rebar-detailing-shop-drawings/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Detailing</a>
              <a href="https://crm.rebar.shop/contactus" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Contact</a>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-foreground mb-2">Follow Us</p>
            <div className="flex items-center gap-4">
              <a href="https://www.linkedin.com/company/rebar-shop" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors" aria-label="LinkedIn">
                LinkedIn
              </a>
              <a href="https://www.facebook.com/rebarshop" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors" aria-label="Facebook">
                Facebook
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
