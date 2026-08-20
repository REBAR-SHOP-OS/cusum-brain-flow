import { useQuickBooksData } from "@/hooks/useQuickBooksData";
import { AccountingDocuments } from "@/components/accounting/AccountingDocuments";

export default function SalesQuotations() {
  const qb = useQuickBooksData();

  return (
    <div className="flex flex-col h-full">
      <AccountingDocuments data={qb} initialDocType="quotation" />
    </div>
  );
}
