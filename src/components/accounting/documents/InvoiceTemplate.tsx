import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import brandLogo from "@/assets/brand-logo.png";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxes?: string;
  amount: number;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  source?: string;
  customerName: string;
  customerAddress?: string;
  items: LineItem[];
  inclusions?: string[];
  untaxedAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paidAmount?: number;
  amountDue: number;
  paymentCommunication?: string;
}

interface Props {
  data: InvoiceData;
  onClose: () => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function InvoiceTemplate({ data, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8">
      {/* Action bar - hidden in print */}
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
        <Button size="sm" onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" /> Print / PDF
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div
        ref={printRef}
        className="bg-white text-black w-[210mm] min-h-[297mm] p-10 shadow-2xl print:shadow-none print:p-8 print:w-full"
      >
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
            <h2 className="text-2xl font-black text-gray-900">Invoice {data.invoiceNumber}</h2>
            <p className="text-sm text-gray-500 mt-1">Invoice Date: {data.invoiceDate}</p>
            <p className="text-sm text-gray-500">Due Date: {data.dueDate}</p>
            {data.source && <p className="text-sm text-gray-500">Source: {data.source}</p>}
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Bill To</p>
          <p className="text-base font-semibold text-gray-900">{data.customerName}</p>
          {data.customerAddress && <p className="text-sm text-gray-600">{data.customerAddress}</p>}
        </div>

        {/* Line items table */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 font-bold">Description</th>
              <th className="text-right py-2 font-bold w-20">Qty</th>
              <th className="text-right py-2 font-bold w-24">Unit Price</th>
              <th className="text-right py-2 font-bold w-24">Taxes</th>
              <th className="text-right py-2 font-bold w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-3 pr-4 text-gray-700 text-xs leading-relaxed">{item.description}</td>
                <td className="py-3 text-right tabular-nums">{item.quantity.toFixed(2)}</td>
                <td className="py-3 text-right tabular-nums">{fmt(item.unitPrice)}</td>
                <td className="py-3 text-right text-gray-500 text-xs">{item.taxes || "—"}</td>
                <td className="py-3 text-right font-semibold tabular-nums">{fmt(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Inclusions */}
        {data.inclusions && data.inclusions.length > 0 && (
          <div className="mb-6">
            <p className="font-bold text-sm mb-2">Inclusion:</p>
            <ul className="text-xs text-gray-700 space-y-0.5">
              {data.inclusions.map((inc, idx) => (
                <li key={idx}>{inc}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Untaxed Amount:</span>
              <span className="tabular-nums">{fmt(data.untaxedAmount)}</span>
            </div>
            {data.paymentCommunication && (
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Communication:</span>
                <span>{data.paymentCommunication}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Tax {(data.taxRate * 100).toFixed(0)}%:</span>
              <span className="tabular-nums">{fmt(data.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-gray-900 pt-2 mt-2">
              <span>Total:</span>
              <span className="tabular-nums">{fmt(data.total)}</span>
            </div>
            {data.paidAmount !== undefined && data.paidAmount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Paid:</span>
                <span className="tabular-nums">{fmt(data.paidAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t-2 border-gray-900 pt-2 mt-1">
              <span>Amount Due:</span>
              <span className="tabular-nums">{fmt(data.amountDue)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400 space-y-0.5">
          <p>☎ 6472609403 · ✉ accounting@rebar.shop · http://www.rebar.shop</p>
          <p>761487149RT0001</p>
        </div>
      </div>
    </div>
  );
}
