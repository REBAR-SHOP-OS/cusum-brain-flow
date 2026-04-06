import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ShieldAlert, Loader2 } from "lucide-react";
import logoCoin from "@/assets/logo-coin.png";
import loginBg from "@/assets/login-bg.png";
import { useToast } from "@/hooks/use-toast";

interface InviteData {
  email: string | null;
  company_id: string | null;
  role: string | null;
}

export default function Signup() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [validating, setValidating] = useState(true);
  const [inviteValid, setInviteValid] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);

  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }

    const validate = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("validate-invite", {
          body: { token },
        });

        if (error || !data?.valid) {
          setInviteValid(false);
        } else {
          setInviteValid(true);
          setInviteData({ email: data.email, company_id: data.company_id, role: data.role });
          if (data.email) setEmail(data.email);
        }
      } catch {
        setInviteValid(false);
      }
      setValidating(false);
    };

    validate();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signUp(email, password);

    if (error) {
      toast({
        title: "Signup failed",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Consume the invite token
    try {
      await supabase.functions.invoke("consume-invite", {
        body: { token, email },
      });
    } catch {
      // Non-blocking — profile/role assignment can be fixed later
    }

    setSuccess(true);
    setLoading(false);
  };

  // Loading state
  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Validating invite...
        </div>
      </div>
    );
  }

  // No token or invalid token
  if (!token || !inviteValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-semibold mb-2">Invalid invite</h1>
            <p className="text-muted-foreground text-sm">
              This invite link is invalid or has expired. Contact your admin for a new one.
            </p>
          </div>
          <Link to="/login">
            <Button variant="outline" className="mt-4">
              Back to login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <div>
            <h1 className="text-xl font-semibold mb-2">Check your email</h1>
            <p className="text-muted-foreground text-sm">
              We sent a confirmation link to <strong>{email}</strong>
            </p>
          </div>
          <Link to="/login">
            <Button variant="outline" className="mt-4">
              Back to login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Signup form (invite-only)
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <img
          src={loginBg}
          alt=""
          className="w-full h-full object-cover opacity-20 animate-[pulse_8s_ease-in-out_infinite]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/60" />
      </div>
      <div className="relative z-10 w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <img src={logoCoin} alt="REBAR SHOP OS" className="w-14 h-14 rounded-xl" />
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Create account</h1>
            <p className="text-sm text-muted-foreground">You've been invited to join REBAR SHOP OS</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              readOnly={!!inviteData?.email}
              className="h-11 bg-secondary border-0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-11 bg-secondary border-0"
            />
            <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
          </div>

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
