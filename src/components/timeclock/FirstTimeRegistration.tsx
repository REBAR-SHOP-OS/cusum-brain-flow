import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UserPlus, Check, Loader2, Search, UserCheck, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Candidate {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface FirstTimeRegistrationProps {
  captureFrame: () => string | null;
  onComplete: (profileId: string, name: string) => void;
  onCancel: () => void;
}

type Step = "input" | "searching" | "choose" | "submitting" | "success";

export function FirstTimeRegistration({ captureFrame, onComplete, onCancel }: FirstTimeRegistrationProps) {
  const [name, setName] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [completedName, setCompletedName] = useState("");

  const handleSearch = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      toast.error("Please enter at least 2 characters");
      return;
    }

    setStep("searching");
    try {
      const { data, error } = await supabase.functions.invoke("kiosk-lookup", {
        body: { name: trimmed },
      });

      if (error) throw new Error("Lookup failed");

      const found: Candidate[] = data?.candidates || [];
      if (found.length > 0) {
        setCandidates(found);
        setStep("choose");
      } else {
        // No matches — go straight to register as new
        await registerNew(trimmed);
      }
    } catch (err: any) {
      console.error("[FirstTimeReg] lookup error:", err);
      toast.error("Search failed, registering as new...");
      await registerNew(trimmed);
    }
  };

  const registerNew = async (trimmedName: string) => {
    setStep("submitting");
    try {
      const { data, error } = await supabase.functions.invoke("kiosk-register", {
        body: { name: trimmedName },
      });
      if (error || data?.error) throw new Error(data?.error || "Registration failed");

      setCompletedName(trimmedName);
      setStep("success");
      toast.success(`Welcome ${trimmedName}! You're clocked in.`);
      setTimeout(() => onComplete(data.profile_id, trimmedName), 3000);
    } catch (err: any) {
      console.error("[FirstTimeReg] register error:", err);
      toast.error(err.message || "Registration failed");
      setStep("input");
    }
  };

  const handleSelectCandidate = async (candidate: Candidate) => {
    setStep("submitting");
    try {
      const faceBase64 = captureFrame();
      const { data, error } = await supabase.functions.invoke("kiosk-register", {
        body: { name: candidate.full_name, faceBase64, existingProfileId: candidate.id },
      });
      if (error || data?.error) throw new Error(data?.error || "Registration failed");

      setCompletedName(candidate.full_name);
      setStep("success");
      toast.success(`Welcome back ${candidate.full_name}! You're clocked in.`);
      setTimeout(() => onComplete(data.profile_id, candidate.full_name), 3000);
    } catch (err: any) {
      console.error("[FirstTimeReg] select error:", err);
      toast.error(err.message || "Registration failed");
      setStep("choose");
    }
  };

  const handleNewUser = async () => {
    await registerNew(name.trim());
  };

  // Success screen
  if (step === "success") {
    return (
      <Card className="border-green-500/40 bg-green-500/5">
        <CardContent className="p-6 text-center space-y-3">
          <Check className="w-12 h-12 mx-auto text-green-500" />
          <h3 className="font-bold text-xl">Welcome, {completedName}!</h3>
          <p className="text-sm text-muted-foreground">
            You're registered and clocked in. Next time, just scan your face!
          </p>
        </CardContent>
      </Card>
    );
  }

  // Candidate selection screen
  if (step === "choose") {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <Search className="w-10 h-10 mx-auto text-primary" />
            <h3 className="font-bold text-lg">Are you one of these people?</h3>
            <p className="text-sm text-muted-foreground">
              We found employees matching "{name.trim()}". Select yourself or register as new.
            </p>
          </div>

          <div className="space-y-2">
            {candidates.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3 px-4"
                onClick={() => handleSelectCandidate(c)}
              >
                <Avatar className="h-10 w-10">
                  {c.avatar_url && <AvatarImage src={c.avatar_url} />}
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {c.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <div className="font-semibold">{c.full_name}</div>
                  <div className="text-xs text-muted-foreground">Yes, this is me</div>
                </div>
                <UserCheck className="w-5 h-5 text-green-500" />
              </Button>
            ))}
          </div>

          <div className="border-t pt-3 space-y-2">
            <Button
              variant="default"
              className="w-full gap-2 font-bold"
              onClick={handleNewUser}
            >
              <UserX className="w-4 h-4" />
              No, I'm a new employee
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => { setStep("input"); setCandidates([]); }}>
              ← Go back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading/submitting screen
  if (step === "searching" || step === "submitting") {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6 text-center space-y-3">
          <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin" />
          <h3 className="font-bold text-lg">
            {step === "searching" ? "Searching..." : "Registering..."}
          </h3>
          <p className="text-sm text-muted-foreground">
            {step === "searching" ? "Looking for matching employees" : "Setting up your profile and clocking in"}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Input screen (default)
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-6 space-y-4">
        <div className="text-center space-y-2">
          <UserPlus className="w-10 h-10 mx-auto text-primary" />
          <h3 className="font-bold text-lg">First Time Here?</h3>
          <p className="text-sm text-muted-foreground">
            We didn't recognize your face. Enter your name to find your profile or register.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="employee-name">Your Name</Label>
          <Input
            id="employee-name"
            placeholder="e.g. Kourosh or John Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="flex-1 gap-2 font-bold" onClick={handleSearch} disabled={!name.trim() || name.trim().length < 2}>
            <Search className="w-4 h-4" />
            Search & Register
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
