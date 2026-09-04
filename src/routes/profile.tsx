import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { User, Mail, ShieldCheck, Building, Megaphone, Calendar, LogOut, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "User Profile — Zexpand" },
      { name: "description", content: "View and manage your Zexpand user profile." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { currentUser, branches, campaigns, logout } = useStore();
  const navigate = useNavigate();

  if (!currentUser) return null;

  const branchObj = branches.find((b) => b.id === currentUser.branchId);
  const campaignObj = campaigns.find((c) => c.id === currentUser.campaignId);

  const branchName = branchObj?.name || currentUser.branchName || currentUser.branch || "Workspace HQ";
  const campaignName = campaignObj?.name || currentUser.campaignName || "General Campaign";

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account details and workspace role</p>
      </div>

      {/* Profile Main Card */}
      <Card className="shadow-lg border rounded-2xl overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-primary/20 via-primary/10 to-background border-b flex items-end p-6" />

        <CardContent className="pt-0 relative px-6 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 mb-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-24 w-24 border-4 border-background shadow-md">
                {currentUser.picture ? (
                  <AvatarImage src={currentUser.picture} alt={currentUser.name} />
                ) : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {currentUser.avatar}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1 pt-2">
                <h2 className="text-xl font-bold text-foreground">{currentUser.name}</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{currentUser.email}</span>
                </div>
              </div>
            </div>

            <Badge className="capitalize px-3 py-1 text-xs font-bold gap-1.5 shadow-2xs">
              <ShieldCheck className="h-3.5 w-3.5" /> {currentUser.role} Account
            </Badge>
          </div>

          {/* User Details Grid */}
          <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t">
            <div className="rounded-xl border bg-card p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Building className="h-4 w-4 text-primary" /> Assigned Branch
              </div>
              <p className="text-sm font-bold text-foreground">{branchName}</p>
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Megaphone className="h-4 w-4 text-primary" /> Assigned Campaign
              </div>
              <p className="text-sm font-bold text-foreground">{campaignName}</p>
            </div>
          </div>

          {/* Account Actions */}
          <div className="mt-6 border-t pt-4 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 cursor-pointer rounded-lg text-xs font-bold border-primary/30 text-primary hover:bg-primary/10"
              onClick={async () => {
                const { subscribeUserToPush, sendTestNotification } = await import("@/lib/push-notifications");
                const { toast } = await import("sonner");
                try {
                  const success = await subscribeUserToPush();
                  if (success) {
                    await sendTestNotification();
                    toast.success("Mobile PWA Push Notifications activated!");
                  } else {
                    toast.info("Please allow Notification permissions in browser settings.");
                  }
                } catch (err: any) {
                  toast.error("Failed to enable push notifications.");
                }
              }}
            >
              <Bell className="h-4 w-4" /> Enable & Test Mobile Push Notifications
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="gap-2 cursor-pointer rounded-lg text-xs"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" /> Sign Out of Workspace
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
