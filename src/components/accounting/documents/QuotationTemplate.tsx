import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import brandLogo from "@/assets/brand-logo.png";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface QuotationData {
  quoteNumber: string;
  quoteDate: string;
  expirationDate: string;
  customerName: string;
  customerAddress?: string;
  projectName?: string;
  items: LineItem[];
  inclusions?: string[];
  exclusions?: string[];
  untaxedAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  terms?: string[];
}

interface Props {
  data: QuotationData;
  onClose: () => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function QuotationTemplate({ data, onClose }: Props) {
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8">
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
        <Button size="sm" onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" /> Print / PDF
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="bg-white text-black w-[210mm] min-h-[297mm] p-10 shadow-2xl print:shadow-none print:p-8 print:w-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-3">
            <img src={brandLogo} alt="Rebar.Shop" className="w-12 h-12 rounded-full object-contain" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Rebar.Shop Inc</h1>
              <p className="text-xs text-gray-500">9 Cedar Ave, Thornhill L3T 3W1, Canada</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-black text-gray-900">Quotation {data.quoteNumber}</h2>
            <p className="text-sm text-gray-500 mt-1">Date: {data.quoteDate}</p>
            <p className="text-sm text-gray-500">Valid Until: {data.expirationDate}</p>
          </div>
        </div>

        {/* Customer & Project */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Customer</p>
            <p className="text-base font-semibold">{data.customerName}</p>
            {data.customerAddress && <p className="text-sm text-gray-600">{data.customerAddress}</p>}
          </div>
          {data.projectName && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Project</p>
              <p className="text-base font-semibold">{data.projectName}</p>
            </div>
          )}
        </div>

        {/* Items table */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 font-bold">Description</th>
              <th className="text-right py-2 font-bold w-20">Qty</th>
              <th className="text-right py-2 font-bold w-24">Unit Price</th>
              <th className="text-right py-2 font-bold w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-3 pr-4 text-gray-700 text-xs leading-relaxed">{item.description}</td>
                <td className="py-3 text-right tabular-nums">{item.quantity.toFixed(2)}</td>
                <td className="py-3 text-right tabular-nums">{fmt(item.unitPrice)}</td>
                <td className="py-3 text-right font-semibold tabular-nums">{fmt(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Inclusions & Exclusions */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {data.inclusions && data.inclusions.length > 0 && (
            <div>
              <p className="font-bold text-sm mb-2">Inclusions:</p>
              <ul className="text-xs text-gray-700 space-y-0.5">
                {data.inclusions.map((inc, idx) => (
                  <li key={idx}>✅ {inc}</li>
                ))}
              </ul>
            </div>
          )}
          {data.exclusions && data.exclusions.length > 0 && (
            <div>
              <p className="font-bold text-sm mb-2">Exclusions:</p>
              <ul className="text-xs text-gray-700 space-y-0.5">
                {data.exclusions.map((exc, idx) => (
                  <li key={idx}>➖ {exc}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Terms */}
        {data.terms && data.terms.length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="font-bold text-sm mb-2">Terms & Conditions:</p>
            <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
              {data.terms.map((t, idx) => (
                <li key={idx}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal:</span>
              <span className="tabular-nums">{fmt(data.untaxedAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tax {(data.taxRate * 100).toFixed(0)}%:</span>
              <span className="tabular-nums">{fmt(data.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t-2 border-gray-900 pt-2 mt-2">
              <span>Total:</span>
              <span className="tabular-nums">{fmt(data.total)}</span>
            </div>
          </div>
        </div>

        {/* Signature area */}
        <div className="mt-12 grid grid-cols-2 gap-12">
          <div>
            <div className="border-b border-gray-300 pb-1 mb-1 h-12" />
            <p className="text-xs text-gray-500">Client Signature & Date</p>
          </div>
          <div>
            <div className="border-b border-gray-300 pb-1 mb-1 h-12" />
            <p className="text-xs text-gray-500">Rebar.Shop Authorized Signature</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400 space-y-0.5">
          <p>☎ 6472609403 · ✉ accounting@rebar.shop · http://www.rebar.shop</p>
          <p>761487149RT0001</p>
        </div>
      </div>
    </div>
  );
}
