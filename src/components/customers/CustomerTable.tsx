import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, ChevronDown } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;

export type SortField = "name" | "company_name" | "open_balance";
export type SortDir = "asc" | "desc";

interface CustomerRow {
  customer: Customer;
  phone: string | null;
  openBalance: number;
}

interface CustomerTableProps {
  rows: CustomerRow[];
  isLoading: boolean;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  onRowClick: (id: string) => void;
  onCreateInvoice?: (customer: Customer) => void;
}

function formatCurrency(val: number) {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function SortableHeader({
  label,
  field,
  current,
  dir,
  onSort,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => onSort(field)}
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${current === field ? "text-foreground" : "text-muted-foreground/50"}`} />
    </button>
  );
}

export function CustomerTable({ rows, isLoading, sortField, sortDir, onSort, onRowClick, onCreateInvoice }: CustomerTableProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[280px]">
            <SortableHeader label="NAME" field="name" current={sortField} dir={sortDir} onSort={onSort} />
          </TableHead>
          <TableHead>
            <SortableHeader label="COMPANY NAME" field="company_name" current={sortField} dir={sortDir} onSort={onSort} />
          </TableHead>
          <TableHead>PHONE</TableHead>
          <TableHead className="text-right">
            <SortableHeader label="OPEN BALANCE" field="open_balance" current={sortField} dir={sortDir} onSort={onSort} />
          </TableHead>
          <TableHead className="w-[160px] text-right">ACTION</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
              No customers found
            </TableCell>
          </TableRow>
        ) : (
          rows.map(({ customer, phone, openBalance }) => (
            <TableRow
              key={customer.id}
              className="cursor-pointer"
              onClick={() => onRowClick(customer.id)}
            >
              <TableCell>
                <div>
                  <span className="font-medium text-primary hover:underline">{customer.name}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge
                      variant={customer.status === "active" ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {customer.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{customer.customer_type}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{customer.company_name || "—"}</TableCell>
              <TableCell className="text-muted-foreground">{phone || "—"}</TableCell>
              <TableCell className="text-right font-medium">
                {openBalance > 0 ? formatCurrency(openBalance) : "—"}
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      Create invoice <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onCreateInvoice?.(customer)}>
                      Create invoice
                    </DropdownMenuItem>
                    <DropdownMenuItem>Create sales receipt</DropdownMenuItem>
                    <DropdownMenuItem>Create estimate</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Create statement</DropdownMenuItem>
                    <DropdownMenuItem>Make inactive</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
