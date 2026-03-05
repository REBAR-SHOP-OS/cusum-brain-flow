import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FirstTimeRegistrationProps {
  captureFrame: () => string | null;
  onComplete: (profileId: string, name: string) => void;
  onCancel: () => void;
}

export function FirstTimeRegistration({ captureFrame, onComplete, onCancel }: FirstTimeRegistrationProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      toast.error("Please enter your full name");
      return;
    }

    setSubmitting(true);
    try {
      const faceBase64 = captureFrame();

      const { data, error } = await supabase.functions.invoke("kiosk-register", {
        body: { name: trimmed, faceBase64 },
      });

      if (error) {
        throw new Error(typeof error === "object" && error?.message ? error.message : "Registration failed");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setSuccess(true);
      toast.success(`Welcome ${trimmed}! You're clocked in.`);

      setTimeout(() => {
        onComplete(data.profile_id, trimmed);
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
