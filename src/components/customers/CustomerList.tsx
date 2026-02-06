import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;

interface CustomerListProps {
  customers: Customer[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CustomerList({ customers, isLoading, selectedId, onSelect }: CustomerListProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No customers found
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="divide-y divide-border">
        {customers.map((customer) => (
          <button
            key={customer.id}
            onClick={() => onSelect(customer.id)}
            className={cn(
              "w-full text-left p-4 hover:bg-accent/50 transition-colors",
              selectedId === customer.id && "bg-accent"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{customer.name}</p>
                {customer.company_name && (
                  <p className="text-sm text-muted-foreground truncate">
                    {customer.company_name}
                  </p>
                )}
              </div>
              <Badge
                variant={customer.status === "active" ? "default" : "secondary"}
                className="shrink-0"
              >
                {customer.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{customer.customer_type}</span>
              {customer.payment_terms && (
                <>
                  <span>•</span>
                  <span>{customer.payment_terms}</span>
                </>
              )}
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
