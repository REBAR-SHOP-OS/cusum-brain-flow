import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Clock, FileText, ExternalLink } from "lucide-react";

interface QuoteData {
  pageState: "viewable" | "accepted" | "rejected" | "expired";
  quotation_number: string;
  customer_name: string;
  customer_company: string | null;
  line_items: { description: string; quantity: number; unit_price: number; amount: number }[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  valid_until: string | null;
  notes: string;
  terms: string[];
  inclusions: string[];
  exclusions: string[];
}

export default function AcceptQuote() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<{ invoice_number?: string; payment_link?: string } | null>(null);

  useEffect(() => {
    if (!quoteId) return;
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-public-view`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ quote_id: quoteId }),
          }
        );
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error || "Failed to load quotation");
        }
        const data = await res.json();
        setQuote(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [quoteId]);

  const handleAccept = async () => {
    if (!quoteId || !quote) return;
    setSubmitting(true);
    try {
      // Call send-quote-email with accept_and_convert action (no auth needed - uses service key internally)
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-quote-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            quote_id: quoteId,
            customer_email: "", // backend will use stored email
            action: "accept_and_convert",
          }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Failed to process acceptance");
      }
      const result = await res.json();
      setInvoiceResult(result);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md text-center space-y-4">
          <XCircle className="h-16 w-16 text-red-400 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-800">Unable to Load Quotation</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!quote) return null;

  // Already accepted
  if (quote.pageState === "accepted" || success) {
    // Auto-redirect to payment link after 3 seconds
    const paymentLink = invoiceResult?.payment_link;
    if (paymentLink && success) {
      setTimeout(() => {
        window.location.href = paymentLink;
      }, 3000);
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-lg text-center space-y-6 bg-white rounded-2xl shadow-lg p-10">
          <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto" />
          <h1 className="text-3xl font-bold text-gray-900">Order Confirmed!</h1>
          {invoiceResult ? (
            <>
              <p className="text-gray-600 text-lg">
                Invoice <strong>{invoiceResult.invoice_number}</strong> has been created and sent to your email.
              </p>
              {paymentLink ? (
                <>
                  <p className="text-gray-500 text-sm animate-pulse">Redirecting to payment in 3 seconds...</p>
                  <a
                    href={paymentLink}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 text-white px-8 py-4 rounded-lg text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    💳 Pay Now <ExternalLink className="h-5 w-5" />
                  </a>
                </>
              ) : (
                <p className="text-gray-500 text-sm">Check your email for payment details.</p>
              )}
            </>
          ) : (
            <p className="text-gray-600 text-lg">
              This quotation has already been accepted. Check your email for the invoice and payment details.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Expired
  if (quote.pageState === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md text-center space-y-4 bg-white rounded-2xl shadow-lg p-10">
          <Clock className="h-16 w-16 text-yellow-500 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-800">Quotation Expired</h1>
          <p className="text-gray-500">This quotation is no longer valid. Please contact us for a new quote.</p>
        </div>
      </div>
    );
  }

  // Rejected/cancelled
  if (quote.pageState === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md text-center space-y-4 bg-white rounded-2xl shadow-lg p-10">
          <XCircle className="h-16 w-16 text-red-400 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-800">Quotation Unavailable</h1>
          <p className="text-gray-500">This quotation has been cancelled or declined. Please contact us for assistance.</p>
        </div>
      </div>
    );
  }

  // Viewable — show full quote with accept flow
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-[#1a1a2e] text-white rounded-t-2xl px-8 py-6 flex items-center gap-4">
          <img
            src="https://cusum-brain-flow.lovable.app/brand/rebar-logo.png"
            alt="Rebar.shop"
            className="h-10 w-10 rounded-lg"
          />
          <div>
            <h1 className="text-xl font-semibold tracking-wide">Rebar.shop</h1>
            <p className="text-sm text-gray-300">Quotation Review</p>
          </div>
        </div>

        <div className="bg-white rounded-b-2xl shadow-lg">
          {/* Quote summary */}
          <div className="px-8 py-6 border-b">
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Quotation</p>
                <p className="text-2xl font-bold text-gray-900">{quote.quotation_number}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 mb-1">Total Amount</p>
                <p className="text-3xl font-bold text-red-500">${fmt(quote.total_amount)} CAD</p>
              </div>
            </div>
            <div className="mt-4 flex gap-8 text-sm text-gray-500">
              <span>Customer: <strong className="text-gray-800">{quote.customer_name}</strong></span>
              {quote.customer_company && <span>Company: <strong className="text-gray-800">{quote.customer_company}</strong></span>}
              {quote.valid_until && (
                <span>Valid Until: <strong className="text-gray-800">
                  {new Date(quote.valid_until).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}
                </strong></span>
              )}
            </div>
          </div>

          {/* Line items */}
          {quote.line_items.length > 0 && (
            <div className="px-8 py-6 border-b overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b-2">
                    <th className="py-3 pr-4">Description</th>
                    <th className="py-3 pr-4 text-right">Qty</th>
                    <th className="py-3 pr-4 text-right">Unit Price</th>
                    <th className="py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.line_items.map((li, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-3 pr-4 text-gray-800">{li.description}</td>
                      <td className="py-3 pr-4 text-right text-gray-600">{li.quantity}</td>
                      <td className="py-3 pr-4 text-right text-gray-600">${fmt(li.unit_price)}</td>
                      <td className="py-3 text-right font-medium text-gray-900">${fmt(li.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={3} className="text-right py-2 text-gray-500">Subtotal:</td><td className="text-right py-2 font-medium">${fmt(quote.subtotal)}</td></tr>
                  <tr><td colSpan={3} className="text-right py-2 text-gray-500">HST ({quote.tax_rate}%):</td><td className="text-right py-2">${fmt(quote.tax_amount)}</td></tr>
                  <tr><td colSpan={3} className="text-right py-2 text-lg font-bold text-gray-900">Total:</td><td className="text-right py-2 text-lg font-bold text-red-500">${fmt(quote.total_amount)} CAD</td></tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Notes / Inclusions / Exclusions */}
          {(quote.notes || quote.inclusions.length > 0 || quote.exclusions.length > 0) && (
            <div className="px-8 py-6 border-b space-y-4">
              {quote.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Notes</p>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{quote.notes}</pre>
                </div>
              )}
              {quote.inclusions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-600 uppercase mb-2">✅ Inclusions</p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {quote.inclusions.map((item: string, i: number) => <li key={i}>• {item}</li>)}
                  </ul>
                </div>
              )}
              {quote.exclusions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-600 uppercase mb-2">❌ Exclusions</p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {quote.exclusions.map((item: string, i: number) => <li key={i}>• {item}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Terms & Accept */}
          <div className="px-8 py-8 space-y-6">
            <div className="bg-gray-50 border rounded-xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800">Terms & Conditions</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Please review our terms and conditions before accepting this quotation.
                  </p>
                  <a
                    href="https://cusum-brain-flow.lovable.app/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-2 font-medium"
                  >
                    Read Terms & Conditions <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="accept-terms"
                checked={termsAccepted}
                onCheckedChange={(v) => setTermsAccepted(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="accept-terms" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
                I have read and accept the{" "}
                <a href="https://www.erp.rebar.shop/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Terms & Conditions
                </a>
                {" "}and confirm this order.
              </label>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 border border-red-200">
                {error}
              </div>
            )}

            <Button
              onClick={handleAccept}
              disabled={!termsAccepted || submitting}
              className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-lg"
            >
              {submitting ? (
                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Processing...</>
              ) : (
                "✅ Accept & Confirm Order"
              )}
            </Button>

            <p className="text-xs text-center text-gray-400">
              By accepting, an invoice will be generated and sent to your email with a secure payment link.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
