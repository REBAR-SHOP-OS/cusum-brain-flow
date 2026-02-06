import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Users, ArrowLeft } from "lucide-react";
import { CustomerList } from "@/components/customers/CustomerList";
import { CustomerDetail } from "@/components/customers/CustomerDetail";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("customers")
        .select("*")
        .order("name", { ascending: true });

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setSelectedCustomerId(null);
      toast({ title: "Customer deleted" });
    },
    onError: (error) => {
      toast({ title: "Error deleting customer", description: error.message, variant: "destructive" });
    },
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this customer?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingCustomer(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div className="flex items-center gap-2">
          {selectedCustomerId && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden mr-1"
              onClick={() => setSelectedCustomerId(null)}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-semibold">Customers</h1>
            <p className="text-sm text-muted-foreground">
              {customers.length} customer{customers.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsFormOpen(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Customer</span>
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* List Panel */}
        <div className={`${selectedCustomerId ? 'hidden md:flex' : 'flex'} w-full md:w-96 flex-shrink-0 border-r border-border flex-col`}>
          {/* Search */}
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Customer List */}
          <CustomerList
            customers={customers}
            isLoading={isLoading}
            selectedId={selectedCustomerId}
            onSelect={setSelectedCustomerId}
          />
        </div>

        {/* Detail Panel */}
        <div className={`${selectedCustomerId ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}>
          {selectedCustomer ? (
            <CustomerDetail
              customer={selectedCustomer}
              onEdit={() => handleEdit(selectedCustomer)}
              onDelete={() => handleDelete(selectedCustomer.id)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a customer to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      <CustomerFormModal
        open={isFormOpen}
        onOpenChange={handleFormClose}
        customer={editingCustomer}
      />
    </div>
  );
}
