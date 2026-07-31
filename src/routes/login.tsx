import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Lock, Mail, ArrowRight, ShieldCheck, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loginApi } from "@/lib/api";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — MarketOps" },
      { name: "description", content: "Log in to your MarketOps account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { setCurrentUser, refreshData } = useStore();
  const [email, setEmail] = useState("admin@carezza.com");
  const [password, setPassword] = useState("Password123!");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginApi({ email, password });
      if (res.user) {
        setCurrentUser(res.user);
        toast.success(`Welcome back, ${res.user.name}!`);
        await refreshData();
        navigate({ to: "/" });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Password123!");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">MarketOps</h1>
          <p className="text-sm text-muted-foreground">Sign in to your marketing operations workspace</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>Enter your email and password to access your role</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@carezza.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full gap-2 cursor-pointer" disabled={loading}>
                {loading ? "Authenticating..." : "Sign In"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-6 border-t pt-4">
              <div className="mb-2 text-xs font-semibold text-muted-foreground">Demo 3-Tier Accounts:</div>
              <div className="grid gap-2 text-xs">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-start gap-2 text-left cursor-pointer"
                  onClick={() => handleQuickDemo("admin@carezza.com")}
                >
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <div>
                    <span className="font-semibold">Admin:</span> admin@carezza.com
                  </div>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-start gap-2 text-left cursor-pointer"
                  onClick={() => handleQuickDemo("manager.accra@carezza.com")}
                >
                  <UserCheck className="h-4 w-4 text-amber-500" />
                  <div>
                    <span className="font-semibold">Manager:</span> manager.accra@carezza.com
                  </div>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-start gap-2 text-left cursor-pointer"
                  onClick={() => handleQuickDemo("efua@carezza.com")}
                >
                  <Users className="h-4 w-4 text-emerald-500" />
                  <div>
                    <span className="font-semibold">Marketer:</span> efua@carezza.com
                  </div>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
