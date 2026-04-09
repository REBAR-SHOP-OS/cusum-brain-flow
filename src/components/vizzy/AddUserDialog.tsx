import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
      // 1. Insert into allowed_login_emails
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

      // 2. Insert into user_access_overrides with zero access
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

      // 3. Insert stub profile so user appears in avatar bar
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
      <DialogContent className="sm:max-w-md">
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
      </DialogContent>
    </Dialog>
  );
}
