import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;

const customerSchema = z.object({
  // Name & Contact
  name: z.string().trim().min(1, "Display name is required").max(100),
  company_name: z.string().trim().max(100).optional().or(z.literal("")),
  title: z.string().trim().max(20).optional().or(z.literal("")),
  first_name: z.string().trim().max(50).optional().or(z.literal("")),
  middle_name: z.string().trim().max(50).optional().or(z.literal("")),
  last_name: z.string().trim().max(50).optional().or(z.literal("")),
  suffix: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().max(100).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  mobile: z.string().trim().max(30).optional().or(z.literal("")),
  fax: z.string().trim().max(30).optional().or(z.literal("")),
  other_phone: z.string().trim().max(30).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  print_on_check_name: z.string().trim().max(100).optional().or(z.literal("")),
  // Address
  billing_street1: z.string().trim().max(200).optional().or(z.literal("")),
  billing_street2: z.string().trim().max(200).optional().or(z.literal("")),
  billing_city: z.string().trim().max(100).optional().or(z.literal("")),
  billing_province: z.string().trim().max(100).optional().or(z.literal("")),
  billing_postal_code: z.string().trim().max(20).optional().or(z.literal("")),
  billing_country: z.string().trim().max(100).optional().or(z.literal("")),
  shipping_street1: z.string().trim().max(200).optional().or(z.literal("")),
  shipping_street2: z.string().trim().max(200).optional().or(z.literal("")),
  shipping_city: z.string().trim().max(100).optional().or(z.literal("")),
  shipping_province: z.string().trim().max(100).optional().or(z.literal("")),
  shipping_postal_code: z.string().trim().max(20).optional().or(z.literal("")),
  shipping_country: z.string().trim().max(100).optional().or(z.literal("")),
  // Additional Info
  customer_type: z.enum(["business", "individual"]),
  status: z.enum(["active", "inactive", "prospect"]),
  payment_terms: z.enum(["net30", "net60", "net15", "due_on_receipt"]).optional(),
  credit_limit: z.coerce.number().min(0).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

type CustomerFormData = z.infer<typeof customerSchema>;

const defaults: CustomerFormData = {
  name: "", company_name: "", title: "", first_name: "", middle_name: "", last_name: "", suffix: "",
  email: "", phone: "", mobile: "", fax: "", other_phone: "", website: "", print_on_check_name: "",
  billing_street1: "", billing_street2: "", billing_city: "", billing_province: "", billing_postal_code: "", billing_country: "Canada",
  shipping_street1: "", shipping_street2: "", shipping_city: "", shipping_province: "", shipping_postal_code: "", shipping_country: "Canada",
  customer_type: "business", status: "active", payment_terms: "net30", credit_limit: "", notes: "",
};

interface CustomerFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

// ── Collapsible Section ──
function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border rounded-lg">
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-3 text-sm font-semibold hover:bg-accent/50 transition-colors rounded-t-lg">
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CustomerFormModal({ open, onOpenChange, customer }: CustomerFormModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!customer;
  const [sameAsBilling, setSameAsBilling] = useState(false);

  const { data: userCompanyId } = useQuery({
    queryKey: ["user_company_id", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();
      if (error) return null;
      return data?.company_id ?? null;
    },
  });

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (customer) {
      form.reset({
        name: customer.name,
        company_name: customer.company_name || "",
        title: (customer as any).title || "",
        first_name: (customer as any).first_name || "",
        middle_name: (customer as any).middle_name || "",
        last_name: (customer as any).last_name || "",
        suffix: (customer as any).suffix || "",
        email: (customer as any).email || "",
        phone: (customer as any).phone || "",
        mobile: (customer as any).mobile || "",
        fax: (customer as any).fax || "",
        other_phone: (customer as any).other_phone || "",
        website: (customer as any).website || "",
        print_on_check_name: (customer as any).print_on_check_name || "",
        billing_street1: (customer as any).billing_street1 || "",
        billing_street2: (customer as any).billing_street2 || "",
        billing_city: (customer as any).billing_city || "",
        billing_province: (customer as any).billing_province || "",
        billing_postal_code: (customer as any).billing_postal_code || "",
        billing_country: (customer as any).billing_country || "Canada",
        shipping_street1: (customer as any).shipping_street1 || "",
        shipping_street2: (customer as any).shipping_street2 || "",
        shipping_city: (customer as any).shipping_city || "",
        shipping_province: (customer as any).shipping_province || "",
        shipping_postal_code: (customer as any).shipping_postal_code || "",
        shipping_country: (customer as any).shipping_country || "Canada",
        customer_type: (customer.customer_type as "business" | "individual") || "business",
        status: (customer.status as "active" | "inactive" | "prospect") || "active",
        payment_terms: (customer.payment_terms as "net30" | "net60" | "net15" | "due_on_receipt") || "net30",
        credit_limit: customer.credit_limit ?? "",
        notes: customer.notes || "",
      });
    } else {
      form.reset(defaults);
    }
  }, [customer, form]);

  // Copy billing to shipping when checkbox toggled
  useEffect(() => {
    if (sameAsBilling) {
      const v = form.getValues();
      form.setValue("shipping_street1", v.billing_street1 || "");
      form.setValue("shipping_street2", v.billing_street2 || "");
      form.setValue("shipping_city", v.billing_city || "");
      form.setValue("shipping_province", v.billing_province || "");
      form.setValue("shipping_postal_code", v.billing_postal_code || "");
      form.setValue("shipping_country", v.billing_country || "Canada");
    }
  }, [sameAsBilling, form]);

  const mutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const payload = {
        name: data.name,
        company_name: data.company_name || null,
        title: data.title || null,
        first_name: data.first_name || null,
        middle_name: data.middle_name || null,
        last_name: data.last_name || null,
        suffix: data.suffix || null,
        email: data.email || null,
        phone: data.phone || null,
        mobile: data.mobile || null,
        fax: data.fax || null,
        other_phone: data.other_phone || null,
        website: data.website || null,
        print_on_check_name: data.print_on_check_name || null,
        billing_street1: data.billing_street1 || null,
        billing_street2: data.billing_street2 || null,
        billing_city: data.billing_city || null,
        billing_province: data.billing_province || null,
        billing_postal_code: data.billing_postal_code || null,
        billing_country: data.billing_country || null,
        shipping_street1: data.shipping_street1 || null,
        shipping_street2: data.shipping_street2 || null,
        shipping_city: data.shipping_city || null,
        shipping_province: data.shipping_province || null,
        shipping_postal_code: data.shipping_postal_code || null,
        shipping_country: data.shipping_country || null,
        customer_type: data.customer_type,
        status: data.status,
        payment_terms: data.payment_terms || null,
        credit_limit: data.credit_limit ? Number(data.credit_limit) : null,
        notes: data.notes || null,
      };

      if (isEditing && customer) {
        const { error } = await supabase.from("customers").update(payload).eq("id", customer.id);
        if (error) throw error;
      } else {
        if (!userCompanyId) throw new Error("Company ID is required to create a customer");
        const { error } = await supabase.from("customers").insert({ ...payload, company_id: userCompanyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["local_customer_by_qb"] });
      toast({ title: isEditing ? "Customer updated" : "Customer created" });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{isEditing ? "Edit Customer" : "Add Customer"}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] px-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4 pt-2">
              {/* ── Section 1: Name and Contact ── */}
              <Section title="Name and Contact" defaultOpen>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="company_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl><Input placeholder="Company name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name *</FormLabel>
                      <FormControl><Input placeholder="Display name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-5 gap-2">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Title</FormLabel>
                      <FormControl><Input placeholder="Mr." {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="first_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">First</FormLabel>
                      <FormControl><Input placeholder="First" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="middle_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Middle</FormLabel>
                      <FormControl><Input placeholder="Middle" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="last_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Last</FormLabel>
                      <FormControl><Input placeholder="Last" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="suffix" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Suffix</FormLabel>
                      <FormControl><Input placeholder="Jr." {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" placeholder="email@example.com" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input placeholder="Phone" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="mobile" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile</FormLabel>
                      <FormControl><Input placeholder="Mobile" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="fax" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fax</FormLabel>
                      <FormControl><Input placeholder="Fax" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="other_phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Other Phone</FormLabel>
                      <FormControl><Input placeholder="Other phone" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="website" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl><Input placeholder="www.example.com" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="print_on_check_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Print on Cheque as</FormLabel>
                    <FormControl><Input placeholder="Name on cheques" {...field} /></FormControl>
                  </FormItem>
                )} />
              </Section>

              {/* ── Section 2: Address ── */}
              <Section title="Address">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Billing Address</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="billing_street1" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Street 1</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="billing_street2" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Street 2</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <FormField control={form.control} name="billing_city" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">City</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="billing_province" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Province</FormLabel><FormControl><Input placeholder="ON" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="billing_postal_code" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Postal Code</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="billing_country" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Country</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Checkbox id="same-as-billing" checked={sameAsBilling} onCheckedChange={(v) => setSameAsBilling(!!v)} />
                  <label htmlFor="same-as-billing" className="text-xs cursor-pointer">Same as billing address</label>
                </div>

                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">Shipping Address</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="shipping_street1" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Street 1</FormLabel><FormControl><Input disabled={sameAsBilling} {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="shipping_street2" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Street 2</FormLabel><FormControl><Input disabled={sameAsBilling} {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <FormField control={form.control} name="shipping_city" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">City</FormLabel><FormControl><Input disabled={sameAsBilling} {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="shipping_province" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Province</FormLabel><FormControl><Input disabled={sameAsBilling} {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="shipping_postal_code" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Postal Code</FormLabel><FormControl><Input disabled={sameAsBilling} {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="shipping_country" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Country</FormLabel><FormControl><Input disabled={sameAsBilling} {...field} /></FormControl></FormItem>
                  )} />
                </div>
              </Section>

              {/* ── Section 3: Additional Info ── */}
              <Section title="Additional Info">
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="customer_type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="business">Business</SelectItem>
                          <SelectItem value="individual">Individual</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="prospect">Prospect</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="payment_terms" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                          <SelectItem value="net15">Net 15</SelectItem>
                          <SelectItem value="net30">Net 30</SelectItem>
                          <SelectItem value="net60">Net 60</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="credit_limit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credit Limit</FormLabel>
                      <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea placeholder="Internal notes..." {...field} /></FormControl>
                  </FormItem>
                )} />
              </Section>

              {/* ── Actions ── */}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : isEditing ? "Save Changes" : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
