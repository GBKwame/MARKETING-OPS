import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Sparkles,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Users,
  UserPlus,
  Building,
  Megaphone,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { registerApi, verifyInvitationApi, googleAuthApi } from "@/lib/api";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

interface RegisterSearch {
  email?: string;
  token?: string;
}

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): RegisterSearch => ({
    email: search.email as string,
    token: search.token as string,
  }),
  head: () => ({
    meta: [
      { title: "Create Account — MarketOps" },
      { name: "description", content: "Create an account to join MarketOps workspace." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/register" });
  const { setCurrentUser, refreshData } = useStore();

  const [email, setEmail] = useState(search.email || "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [invitationInfo, setInvitationInfo] = useState<{
    exists: boolean;
    userExists?: boolean;
    name?: string;
    email?: string;
    role?: string;
    branchName?: string;
    campaignName?: string;
  } | null>(null);

  useEffect(() => {
    if (search.email) {
      setEmail(search.email);
      verifyInvitationApi({ email: search.email, token: search.token }).then((res) => {
        if (res.exists) {
          setInvitationInfo(res);
          if (res.name) setName(res.name);
          if (res.userExists) {
            toast.info("Account already exists. Please sign in.");
            navigate({ to: "/login", search: { email: search.email, token: search.token } });
          }
        }
      }).catch(() => null);
    }
  }, [search.email, search.token, navigate]);

  // Google Identity Services Initialization
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "1084285816926-sampleclientid.apps.googleusercontent.com";
    if (typeof window === "undefined") return;

    if (!document.getElementById("google-jssdk")) {
      const script = document.createElement("script");
      script.id = "google-jssdk";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if ((window as any).google?.accounts?.id) {
          (window as any).google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              if (response?.credential) {
                setLoading(true);
                try {
                  const res = await googleAuthApi({ credential: response.credential });
                  if (res.user) {
                    setCurrentUser(res.user);
                    toast.success(`Welcome, ${res.user.name}! Account created via Google OAuth.`);
                    await refreshData();
                    navigate({ to: "/" });
                  }
                } catch (err: any) {
                  toast.error(err.message || "Google OAuth sign up failed.");
                } finally {
                  setLoading(false);
                }
              }
            },
          });
        }
      };
      document.head.appendChild(script);
    }
  }, []);

  // Handle Google Sign In Button Click via Real Google OAuth2 Popup
  const handleGoogleSignIn = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "840275158851-e4bv7br4djdi4brnu1qb7s7a27ed6sgi.apps.googleusercontent.com";

    if (typeof window !== "undefined" && (window as any).google?.accounts?.oauth2) {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
        callback: async (tokenResponse: any) => {
          if (tokenResponse?.access_token) {
            setLoading(true);
            try {
              const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              });
              const googleProfile = await userRes.json();
              if (googleProfile?.email) {
                const res = await googleAuthApi({
                  email: googleProfile.email,
                  name: googleProfile.name,
                  picture: googleProfile.picture,
                });
                if (res.user) {
                  setCurrentUser(res.user);
                  toast.success(`Welcome, ${res.user.name}! Signed in via Google.`);
                  await refreshData();
                  navigate({ to: "/" });
                }
              }
            } catch (err: any) {
              toast.error(err.message || "Google OAuth sign in failed.");
            } finally {
              setLoading(false);
            }
          }
        },
      });
      tokenClient.requestAccessToken();
    } else {
      toast.error("Google OAuth SDK is loading. Please try again in a moment.");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Full Name is required.");
      return;
    }
    if (password !== confirmPassword && !search.email) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await registerApi({
        name: name.trim(),
        email: email.trim(),
        password,
        token: search.token,
      });

      if (res.user) {
        setCurrentUser(res.user);
        toast.success(`Account created! Welcome to MarketOps, ${res.user.name}!`);
        await refreshData();
        navigate({ to: "/" });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">MarketOps</h1>
          <p className="text-sm text-muted-foreground">Create Your Account & Join Workspace</p>
        </div>

        {invitationInfo?.exists && (
          <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2 border-primary/40 bg-primary/5">
            <div className="flex items-center gap-2 font-bold text-xs text-primary">
              <CheckCircle2 className="h-4 w-4" /> Workspace Invitation Detected
            </div>
            <p className="text-xs text-foreground font-medium">
              You've been invited to join as <strong className="uppercase text-primary">{invitationInfo.role}</strong>!
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground pt-1">
              <Badge variant="outline" className="gap-1 bg-background text-[10px]">
                <Building className="h-3 w-3 text-primary" /> {invitationInfo.branchName}
              </Badge>
              <Badge variant="outline" className="gap-1 bg-background text-[10px]">
                <Megaphone className="h-3 w-3 text-primary" /> {invitationInfo.campaignName}
              </Badge>
            </div>
          </div>
        )}

        <Card className="shadow-xl rounded-2xl border overflow-hidden">
          <CardHeader className="pt-5 pb-2">
            <CardTitle className="text-lg">Create Your Account</CardTitle>
            <CardDescription className="text-xs">
              Enter your details below to set your password and join
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-2 pb-6 space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2.5 font-semibold border-input hover:bg-accent h-9 text-xs rounded-lg cursor-pointer transition-all shadow-2xs"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="relative flex items-center justify-center my-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <span className="relative bg-card px-2 text-[10px] uppercase font-semibold text-muted-foreground">
                or continue with email
              </span>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name" className="text-xs font-semibold">Full Name *</Label>
                <Input
                  id="reg-name"
                  type="text"
                  placeholder="e.g. Ama Boateng"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-xs rounded-lg"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="text-xs font-semibold">Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="name@carezza.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-9 text-xs rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-xs font-semibold">Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 h-9 text-xs rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-confirm" className="text-xs font-semibold">Confirm Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-confirm"
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-9 h-9 text-xs rounded-lg"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full gap-2 font-bold cursor-pointer rounded-lg h-9 text-xs shadow-sm mt-2" disabled={loading}>
                {loading ? "Creating Account..." : "Create Account & Join"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="text-center pt-2 text-xs text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                className="font-bold text-primary hover:underline cursor-pointer"
                onClick={() => navigate({ to: "/login", search: { email, token: search.token } })}
              >
                Sign In
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
