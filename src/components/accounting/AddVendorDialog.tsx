import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const emptyForm = {
  companyName: "", displayName: "",
  title: "", firstName: "", middleName: "", lastName: "", suffix: "",
  email: "", phone: "", mobile: "", fax: "", other: "", website: "",
  printOnCheckName: "",
  street1: "", street2: "", city: "", state: "", postalCode: "",
  notes: "",
};

export function AddVendorDialog({ open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [nameOpen, setNameOpen] = useState(true);
  const [addrOpen, setAddrOpen] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const displayName = form.displayName.trim() || form.companyName.trim();
    if (!displayName) {
      toast({ title: "Display name or company name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "create-vendor", displayName, ...form },
      });
      if (error) throw new Error(error.message);
      toast({ title: "✅ Supplier created", description: `${displayName} added to QuickBooks` });
      setForm({ ...emptyForm });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast({ title: "Failed to create supplier", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Supplier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Company + Display Name */}
          <div>
            <Label>Company name</Label>
            <Input value={form.companyName} onChange={set("companyName")} placeholder="Company name" />
          </div>
          <div>
            <Label>Supplier display name *</Label>
            <Input value={form.displayName} onChange={set("displayName")} placeholder="Display name (shown in lists)" />
          </div>

          {/* Name and Contact - Collapsible */}
          <Collapsible open={nameOpen} onOpenChange={setNameOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-primary w-full py-2 border-b">
              <ChevronDown className={`w-4 h-4 transition-transform ${nameOpen ? "rotate-0" : "-rotate-90"}`} />
              Name and contact
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="grid grid-cols-5 gap-2">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input value={form.title} onChange={set("title")} placeholder="Mr." />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">First name</Label>
                  <Input value={form.firstName} onChange={set("firstName")} />
                </div>
                <div>
                  <Label className="text-xs">Middle</Label>
                  <Input value={form.middleName} onChange={set("middleName")} />
                </div>
                <div>
                  <Label className="text-xs">Last name</Label>
                  <Input value={form.lastName} onChange={set("lastName")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Suffix</Label><Input value={form.suffix} onChange={set("suffix")} /></div>
                <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={set("email")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={set("phone")} /></div>
                <div><Label className="text-xs">Mobile</Label><Input value={form.mobile} onChange={set("mobile")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Fax</Label><Input value={form.fax} onChange={set("fax")} /></div>
                <div><Label className="text-xs">Other</Label><Input value={form.other} onChange={set("other")} /></div>
              </div>
              <div>
                <Label className="text-xs">Website</Label>
                <Input value={form.website} onChange={set("website")} placeholder="https://" />
              </div>
              <div>
                <Label className="text-xs">Name to print on cheques</Label>
                <Input value={form.printOnCheckName} onChange={set("printOnCheckName")} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Address - Collapsible */}
          <Collapsible open={addrOpen} onOpenChange={setAddrOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-primary w-full py-2 border-b">
              <ChevronDown className={`w-4 h-4 transition-transform ${addrOpen ? "rotate-0" : "-rotate-90"}`} />
              Address
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div>
                <Label className="text-xs">Street address 1</Label>
                <Input value={form.street1} onChange={set("street1")} />
              </div>
              <div>
                <Label className="text-xs">Street address 2</Label>
                <Input value={form.street2} onChange={set("street2")} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">City</Label><Input value={form.city} onChange={set("city")} /></div>
                <div><Label className="text-xs">Province/State</Label><Input value={form.state} onChange={set("state")} /></div>
                <div><Label className="text-xs">Postal/ZIP</Label><Input value={form.postalCode} onChange={set("postalCode")} /></div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Notes */}
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={form.notes} onChange={set("notes")} placeholder="Internal notes..." />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

AddVendorDialog.displayName = "AddVendorDialog";
