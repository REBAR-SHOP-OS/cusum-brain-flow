import React, { useState } from "react";
import { Dialog, DialogPortal, DialogOverlay, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminEmail: string;
}

export function AddUserDialog({ open, onOpenChange, adminEmail }: AddUserDialogProps) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const handleAdd = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setSaving(true);
    try {
      const { error: emailErr } = await supabase
        .from("allowed_login_emails" as any)
        .insert({ email: normalized, added_by: adminEmail } as any);
      if (emailErr) {
        if (emailErr.code === "23505") {
          toast.error("This email is already whitelisted.");
          setSaving(false);
          return;
        }
        throw emailErr;
      }

      const { error: overrideErr } = await supabase
        .from("user_access_overrides" as any)
        .insert({
          email: normalized,
          agents: [],
          automations: [],
          menus: [],
          updated_by: adminEmail,
          company_id: "rebar",
        } as any);
      if (overrideErr && overrideErr.code !== "23505") {
        console.warn("user_access_overrides insert warning:", overrideErr.message);
      }

      const namePart = normalized.split("@")[0].replace(/[._]/g, " ");
      const { error: profileErr } = await supabase
        .from("profiles")
        .insert({
          full_name: namePart,
          email: normalized,
          company_id: "rebar",
          is_active: true,
        } as any);
      if (profileErr && profileErr.code !== "23505") {
        console.warn("Profile insert warning:", profileErr.message);
      }

      toast.success(`✅ ${normalized} added with zero access.`);
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["user-access-overrides"] });
      setEmail("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[100001]" />
        <DialogPrimitive.Content
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          className="fixed left-[50%] top-[50%] z-[100002] grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg"
        >
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="new-user-email">Email Address</Label>
            <Input
              id="new-user-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <p className="text-xs text-muted-foreground">
              User will be added with zero access. Configure permissions after adding.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving || !email.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Add User
            </Button>
          </DialogFooter>
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
