import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompanyId } from "@/hooks/useCompanyId";

interface FirstTimeRegistrationProps {
  captureFrame: () => string | null;
  onComplete: (profileId: string, name: string) => void;
  onCancel: () => void;
}

export function FirstTimeRegistration({ captureFrame, onComplete, onCancel }: FirstTimeRegistrationProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { companyId } = useCompanyId();

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      toast.error("Please enter your full name");
      return;
    }
    if (!companyId) {
      toast.error("Company not found");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create profile
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .insert({ full_name: trimmed, is_active: true, company_id: companyId } as any)
        .select("id")
        .single();

      if (profileErr || !profile) {
        throw new Error(profileErr?.message || "Failed to create profile");
      }

      const profileId = (profile as any).id;

      // 2. Capture and upload face photo
      const base64 = captureFrame();
      if (base64) {
        const filePath = `${profileId}/enroll-${Date.now()}.jpg`;
        const byteArray = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

        const { error: uploadErr } = await supabase.storage
          .from("face-enrollments")
          .upload(filePath, byteArray, { contentType: "image/jpeg" });

        if (!uploadErr) {
          await supabase
            .from("face_enrollments")
            .insert({ profile_id: profileId, photo_url: filePath } as any);
        } else {
          console.error("[FirstTimeReg] Upload error:", uploadErr);
        }
      }

      // 3. Clock in
      const { error: clockErr } = await supabase
        .from("time_clock_entries")
        .insert({ profile_id: profileId } as any);

      if (clockErr) {
        console.error("[FirstTimeReg] Clock in error:", clockErr);
      }

      setSuccess(true);
      toast.success(`Welcome ${trimmed}! You're clocked in.`);

      setTimeout(() => {
        onComplete(profileId, trimmed);
      }, 3000);
    } catch (err: any) {
      console.error("[FirstTimeReg] Error:", err);
      toast.error(err.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card className="border-green-500/40 bg-green-500/5">
        <CardContent className="p-6 text-center space-y-3">
          <Check className="w-12 h-12 mx-auto text-green-500" />
          <h3 className="font-bold text-xl">Welcome, {name.trim()}!</h3>
          <p className="text-sm text-muted-foreground">
            You're registered and clocked in. Next time, just scan your face!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-6 space-y-4">
        <div className="text-center space-y-2">
          <UserPlus className="w-10 h-10 mx-auto text-primary" />
          <h3 className="font-bold text-lg">First Time Here?</h3>
          <p className="text-sm text-muted-foreground">
            We didn't recognize your face. Enter your name to register and clock in.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="employee-name">Full Name</Label>
          <Input
            id="employee-name"
            placeholder="e.g. John Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
            disabled={submitting}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button className="flex-1 gap-2 font-bold" onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Register & Clock In
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
