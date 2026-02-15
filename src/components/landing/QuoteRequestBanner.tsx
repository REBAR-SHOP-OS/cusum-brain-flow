import { FileText, FileImage, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuoteRequestBanner() {
  return (
    <section className="py-16 px-6" aria-label="Request a quote">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground text-center mb-4">Get a Rebar Quote</h2>
        <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">
          Two fast paths to your quote — pick the one that fits your project stage.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Path 1 */}
          <div className="p-8 rounded-xl border border-border bg-card text-center">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-5" aria-hidden="true">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Send a Bar List</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Already have your bar list ready? Send it over and receive a quote the <strong>same day</strong>.
            </p>
            <a href="https://crm.rebar.shop/contactus" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="text-sm">
                Same-Day Quote <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </a>
          </div>
          {/* Path 2 */}
          <div className="p-8 rounded-xl border border-border bg-card text-center">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-5" aria-hidden="true">
              <FileImage className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Send Structure Drawings</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Upload your structural drawings and our estimators will prepare a detailed quote in <strong>3–7 business days</strong>.
            </p>
            <a href="https://crm.rebar.shop/contactus" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="text-sm">
                Request Estimate <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
