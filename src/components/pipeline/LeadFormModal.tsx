import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProfiles } from "@/hooks/useProfiles";
import { useLeadAssignees } from "@/hooks/useLeadAssignees";
import { PIPELINE_STAGES } from "@/pages/Pipeline";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  customer_id: z.string().optional(),
  stage: z.string(),
  probability: z.coerce.number().min(0).max(100).optional(),
  expected_value: z.coerce.number().min(0).optional(),
  expected_close_date: z.string().optional(),
  source: z.string().optional(),
  priority: z.string(),
  lead_type: z.string().optional(),
  notes: z.string().optional(),
  assigned_to: z.string().optional(),
  territory: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface LeadFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
}

export function LeadFormModal({ open, onOpenChange, lead }: LeadFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const { byLeadId, addAssignee, removeAssignee } = useLeadAssignees();
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-select", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_customers_clean" as any)
        .select("customer_id, display_name, company_name")
        .eq("company_id", companyId!)
        .order("display_name")
        .limit(5000);
      if (error) throw error;
      return (data as unknown) as Array<{customer_id: string; display_name: string; company_name: string | null}>;
    },
  });

  const { profiles } = useProfiles();
  const activeProfiles = (profiles ?? []).filter(p => p.is_active);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      customer_id: "",
      stage: "new",
      probability: 10,
      expected_value: 0,
      expected_close_date: "",
      source: "",
      priority: "medium",
      lead_type: "opportunity",
      notes: "",
      assigned_to: "",
      territory: "",
    },
  });

  useEffect(() => {
    if (lead) {
      // Populate assignees from junction table
      const existing = byLeadId[lead.id] ?? [];
      setSelectedAssignees(existing.map(a => a.profile_id));
      form.reset({
        title: lead.title,
        description: lead.description || "",
        customer_id: lead.customer_id || "",
        stage: lead.stage,
        probability: lead.probability ?? 10,
        expected_value: lead.expected_value ?? 0,
        expected_close_date: lead.expected_close_date
          ? new Date(lead.expected_close_date).toISOString().split("T")[0]
          : "",
        source: lead.source || "",
        priority: lead.priority || "medium",
        lead_type: (lead.metadata as Record<string, unknown>)?.lead_type as string || "opportunity",
        notes: lead.notes || "",
        assigned_to: lead.assigned_to || "",
        territory: (lead as any).territory || "",
      });
    } else {
      setSelectedAssignees([]);
      form.reset({
        title: "",
        description: "",
        customer_id: "",
        stage: "new",
        probability: 10,
        expected_value: 0,
        expected_close_date: "",
        source: "",
        priority: "medium",
        lead_type: "opportunity",
        notes: "",
        assigned_to: "",
        territory: "",
      });
    }
  }, [lead, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const existingMeta = (lead?.metadata as Record<string, unknown>) || {};
      const payload = {
        title: data.title,
        description: data.description || null,
        customer_id: data.customer_id || null,
        stage: data.stage,
        probability: data.probability,
        expected_value: data.expected_value,
        expected_close_date: data.expected_close_date || null,
        source: data.source || null,
        priority: data.priority,
        notes: data.notes || null,
        metadata: { ...existingMeta, lead_type: data.lead_type },
        assigned_to: data.assigned_to || null,
        territory: data.territory || null,
      } as any;

      let leadId = lead?.id;
      if (lead) {
        const { error } = await supabase
          .from("leads")
          .update(payload)
          .eq("id", lead.id);
        if (error) throw error;
      } else {
        const { data: created, error } = await supabase.from("leads").insert({ ...payload, company_id: companyId! }).select("id").single();
        if (error) throw error;
        leadId = created?.id;
      }

      // Sync assignees
      if (leadId && companyId) {
        const existing = byLeadId[leadId] ?? [];
        const existingIds = new Set(existing.map(a => a.profile_id));
        const newIds = new Set(selectedAssignees);
        // Add new
        for (const pid of selectedAssignees) {
          if (!existingIds.has(pid)) {
            await supabase.from("lead_assignees" as any).insert({ lead_id: leadId, profile_id: pid, company_id: companyId });
          }
        }
        // Remove old
        for (const a of existing) {
          if (!newIds.has(a.profile_id)) {
            await supabase.from("lead_assignees" as any).delete().eq("lead_id", leadId).eq("profile_id", a.profile_id);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead_assignees"] });
      toast({ title: lead ? "Lead updated" : "Lead created" });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lead ? "Edit Lead" : "Add Lead"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Lead title..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background border-input">
                        <SelectValue placeholder="Select customer..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.customer_id} value={customer.customer_id}>
                          {customer.company_name || customer.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                      <SelectTrigger className="bg-background border-input">
                           <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PIPELINE_STAGES.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                      <SelectTrigger className="bg-background border-input">
                           <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="lead_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "opportunity"}>
                      <FormControl>
                      <SelectTrigger className="bg-background border-input">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="opportunity">Opportunity</SelectItem>
                        <SelectItem value="lead">Lead</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Select source..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Email">Email</SelectItem>
                        <SelectItem value="Phone / Call">Phone / Call</SelectItem>
                        <SelectItem value="Website">Website</SelectItem>
                        <SelectItem value="Referral">Referral</SelectItem>
                        <SelectItem value="Trade Show">Trade Show</SelectItem>
                        <SelectItem value="Social Media">Social Media</SelectItem>
                        <SelectItem value="Cold Outreach">Cold Outreach</SelectItem>
                        <SelectItem value="Partner">Partner</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="expected_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Value ($)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="probability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Probability (%)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="expected_close_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Close Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Assign To</FormLabel>
                <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal h-10">
                      {selectedAssignees.length > 0
                        ? `${selectedAssignees.length} selected`
                        : <span className="text-muted-foreground">Select members...</span>}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[220px] p-2" align="start">
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {activeProfiles.map(p => (
                        <label key={p.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer text-sm">
                          <Checkbox
                            checked={selectedAssignees.includes(p.id)}
                            onCheckedChange={(checked) => {
                              setSelectedAssignees(prev =>
                                checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                              );
                            }}
                          />
                          {p.full_name}
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </FormItem>

              <FormField
                control={form.control}
                name="territory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Territory</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. West Coast" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Lead details..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Internal notes..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : lead ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
