import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoCoin from "@/assets/logo-coin.png";
import loginBg from "@/assets/login-bg.png";
import { useToast } from "@/hooks/use-toast";
import { ACCESS_POLICIES } from "@/lib/accessPolicies";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { user, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/home");
    }

    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Loading...
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

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
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <img src={logoCoin} alt="REBAR SHOP OS" className="w-14 h-14 rounded-xl" />
          <div className="text-center">
            <h1 className="text-2xl font-semibold">REBAR SHOP OS</h1>
            <p className="text-sm text-muted-foreground">Sign in to continue</p>
          </div>
        </div>

        {/* Form */}
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
              className="h-11 bg-secondary border-0"
            />
          </div>

          <Button type="submit" className="w-full h-11" disabled={loading || googleLoading}>
            {loading ? "Signing in..." : "Sign in with email"}
          </Button>
        </form>

        {/* Separator */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Google Sign In */}
        <Button
          variant="outline"
          className="w-full h-11"
          disabled={loading || googleLoading}
          onClick={async () => {
            setGoogleLoading(true);
            try {
              const result = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (result.error) {
                toast({
                  title: "Google sign in failed",
                  description: result.error.message,
                  variant: "destructive",
                });
              }
              if (result.redirected) return;

              // Check whitelist after Google OAuth
              const { data: { user: oauthUser } } = await supabase.auth.getUser();
              const oauthEmail = oauthUser?.email?.toLowerCase() ?? "";
              if (!ACCESS_POLICIES.allowedLoginEmails.some((e) => e.toLowerCase() === oauthEmail)) {
                await supabase.auth.signOut({ scope: "local" }).catch(() => {});
                toast({
                  title: "Access denied",
                  description: "Your account is not authorized to access this system.",
                  variant: "destructive",
                });
                return;
              }

              navigate("/home");
            } catch (err: any) {
              toast({
                title: "Google sign in failed",
                description: err.message ?? "Unknown error",
                variant: "destructive",
              });
            } finally {
              setGoogleLoading(false);
            }
          }}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {googleLoading ? "Signing in..." : "Sign in with Google"}
        </Button>
      </div>
    </div>
  );
}
