import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Customer {
  Id: string;
  DisplayName?: string;
  CompanyName?: string;
  PrimaryEmailAddr?: { Address?: string };
  Balance?: number;
}

interface CustomerSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  onSelect: (qbId: string, name: string) => void;
}

export function CustomerSelectDialog({
  open,
  onOpenChange,
  customers,
  onSelect,
}: CustomerSelectDialogProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      customers.filter(
        (c) =>
          (c.DisplayName || "").toLowerCase().includes(search.toLowerCase()) ||
          (c.CompanyName || "").toLowerCase().includes(search.toLowerCase())
      ),
    [customers, search]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Customer</DialogTitle>
          <DialogDescription>Choose a customer for the new transaction</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-[300px]">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">No customers found</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((c) => (
                <button
                  key={c.Id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent text-left transition-colors"
                  onClick={() => {
                    onSelect(c.Id, c.DisplayName || "Customer");
                    onOpenChange(false);
                    setSearch("");
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{c.DisplayName}</p>
                    {c.CompanyName && c.CompanyName !== c.DisplayName && (
                      <p className="text-xs text-muted-foreground truncate">{c.CompanyName}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
