import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore, Campaign, Branch } from "@/lib/store";
import { WORKSPACE } from "@/lib/mock-data";
import { ShieldCheck, UserCheck, Users, ShieldAlert, Plus, Building, Megaphone, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  createCampaignApi,
  updateCampaignApi,
  deleteCampaignApi,
  createBranchApi,
  updateBranchApi,
  deleteBranchApi,
} from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — MarketOps" },
      { name: "description", content: "Workspace, team, and notification preferences." },
      { property: "og:title", content: "MarketOps Settings" },
      { property: "og:description", content: "Manage your MarketOps workspace." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { currentUser, members, branches, memberById, campaigns, refreshData } = useStore();

  // Campaign State
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignBudget, setNewCampaignBudget] = useState("");
  const [addingCampaign, setAddingCampaign] = useState(false);

  // Edit Campaign Modal State
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editCampaignName, setEditCampaignName] = useState("");
  const [editCampaignBudget, setEditCampaignBudget] = useState("");
  const [savingCampaign, setSavingCampaign] = useState(false);

  // Branch State
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchLocation, setNewBranchLocation] = useState("");
  const [addingBranch, setAddingBranch] = useState(false);

  // Edit Branch Modal State
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editBranchName, setEditBranchName] = useState("");
  const [editBranchLocation, setEditBranchLocation] = useState("");
  const [savingBranch, setSavingBranch] = useState(false);

  const role = currentUser?.role || "marketer";
  const isAdmin = role === "admin";
  const isMarketer = role === "marketer";

  // Marketer is completely BLOCKED from Settings
  if (isMarketer) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-xl font-bold">Access Restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Settings are restricted to Admins and Managers. As a Marketer, your workspace access is limited to core activities, to-dos, approvals, assets, and leads.
        </p>
        <div className="mt-6">
          <Button asChild size="sm">
            <Link to="/">Return to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const roleIcon = (r: string) => {
    if (r === "admin") return <ShieldCheck className="h-4 w-4 text-primary" />;
    if (r === "manager") return <UserCheck className="h-4 w-4 text-amber-500" />;
    return <Users className="h-4 w-4 text-emerald-500" />;
  };

  // Add Campaign Handler
  const handleAddCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName.trim()) return;
    setAddingCampaign(true);
    try {
      await createCampaignApi({
        name: newCampaignName.trim(),
        budget: Number(newCampaignBudget) || 0,
      });
      toast.success(`Campaign "${newCampaignName}" created!`);
      setNewCampaignName("");
      setNewCampaignBudget("");
      await refreshData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create campaign");
    } finally {
      setAddingCampaign(false);
    }
  };

  // Save Edit Campaign Handler
  const handleSaveEditCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign || !editCampaignName.trim()) return;
    setSavingCampaign(true);
    try {
      await updateCampaignApi(editingCampaign.id, {
        name: editCampaignName.trim(),
        budget: Number(editCampaignBudget) || 0,
      });
      toast.success(`Campaign "${editCampaignName}" updated!`);
      setEditingCampaign(null);
      await refreshData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update campaign");
    } finally {
      setSavingCampaign(false);
    }
  };

  // Delete Campaign Handler
  const handleDeleteCampaign = async (id: string, name: string) => {
    try {
      await deleteCampaignApi(id);
      toast.success(`Campaign "${name}" deleted!`);
      await refreshData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete campaign");
    }
  };

  // Add Branch Handler
  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    setAddingBranch(true);
    try {
      await createBranchApi({
        name: newBranchName.trim(),
        location: newBranchLocation.trim() || undefined,
      });
      toast.success(`Branch "${newBranchName}" created!`);
      setNewBranchName("");
      setNewBranchLocation("");
      await refreshData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create branch");
    } finally {
      setAddingBranch(false);
    }
  };

  // Save Edit Branch Handler
  const handleSaveEditBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch || !editBranchName.trim()) return;
    setSavingBranch(true);
    try {
      await updateBranchApi(editingBranch.id, {
        name: editBranchName.trim(),
        location: editBranchLocation.trim() || undefined,
      });
      toast.success(`Branch "${editBranchName}" updated!`);
      setEditingBranch(null);
      await refreshData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update branch");
    } finally {
      setSavingBranch(false);
    }
  };

  // Delete Branch Handler
  const handleDeleteBranch = async (id: string, name: string) => {
    try {
      await deleteBranchApi(id);
      toast.success(`Branch "${name}" deleted!`);
      await refreshData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete branch");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Settings"
        description={
          isAdmin
            ? "Full Administrator Access — Workspace, User Roles, Branches & Campaigns"
            : "Manager Access — Workspace, Branch & Campaign Operations"
        }
      />

      {/* Role Access Banner */}
      <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            {roleIcon(role)}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current Role: <span className="capitalize text-foreground font-bold">{role}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {isAdmin
                ? "You have full permissions to manage users, roles, branches, and campaigns."
                : "You can manage branches and campaigns. User role modification is restricted to Admins."}
            </div>
          </div>
        </div>
        <Badge variant={isAdmin ? "default" : "outline"} className="capitalize">
          {role}
        </Badge>
      </div>

      {/* Workspace Section */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
              CZ
            </div>
            <div>
              <div className="font-medium text-base">{WORKSPACE}</div>
              <div className="text-xs text-muted-foreground">
                {members.length} active team members · {branches.length} operational branches
              </div>
            </div>
          </div>
          <Button asChild size="sm" className="gap-1.5 font-semibold">
            <Link to="/team">
              <Users className="h-4 w-4" /> Go to Team Management
            </Link>
          </Button>
        </div>
      </section>

      {/* Team & Branch/Campaign Link Alert */}
      <div className="rounded-2xl border bg-primary/5 p-5 text-xs text-muted-foreground flex items-center justify-between">
        <div>
          <span className="font-bold text-foreground">Centralized Team & Creation Hub:</span> Creation of Branches and Campaigns, as well as Member invitations and role upgrades, are now managed in the dedicated <strong className="text-primary">Team</strong> tab.
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0 ml-4 font-semibold">
          <Link to="/team">Open Team Tab</Link>
        </Button>
      </div>

      {/* User Management & Hierarchy */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Team & Role Management</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isAdmin
                ? "Manage users and assign roles (Admin, Manager, Marketer)."
                : "View team hierarchy (Role modification restricted to Admins)."}
            </p>
          </div>
          {!isAdmin && (
            <Badge variant="secondary" className="text-[10px]">
              Admin Only Controls
            </Badge>
          )}
        </div>
        <div className="mt-4 divide-y">
          {members.map((m) => {
            const supervisor = m.supervisorId ? memberById(m.supervisorId) : null;
            return (
              <div key={m.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs font-semibold">{m.avatar}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {roleIcon(m.role)}
                      <span>{m.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.email} · {m.branch} {supervisor && `· Supervised by ${supervisor.name}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize text-xs">
                    {m.role}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Campaign Management */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Megaphone className="h-4 w-4 text-primary" />
            <span>Manage Campaigns</span>
          </div>
        </div>

        {isAdmin && (
          <form onSubmit={handleAddCampaign} className="mt-4 flex flex-wrap gap-2">
            <Input
              placeholder="Campaign Name..."
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              className="h-9 w-48 text-xs sm:w-64"
              required
            />
            <Input
              type="number"
              placeholder="Budget ($)"
              value={newCampaignBudget}
              onChange={(e) => setNewCampaignBudget(e.target.value)}
              className="h-9 w-28 text-xs"
            />
            <Button type="submit" size="sm" className="h-9 gap-1.5 cursor-pointer font-semibold" disabled={addingCampaign}>
              <Plus className="h-4 w-4" /> {addingCampaign ? "Adding..." : "Add Campaign"}
            </Button>
          </form>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {campaigns.map((c) => {
            const isAllotted = currentUser?.campaignId === c.id;
            return (
              <div key={c.id} className={`flex items-center justify-between rounded-xl border p-3 text-xs ${isAllotted ? "border-primary/50 bg-primary/5" : "bg-background"}`}>
                <div className="min-w-0 pr-2">
                  <div className="font-semibold text-foreground truncate">{c.name}</div>
                  <div className="text-muted-foreground truncate">{c.description || "Active Campaign"}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="font-semibold">
                    ${c.budget.toLocaleString()}
                  </Badge>
                  {isAdmin && (
                    <>
                      {/* Edit Campaign Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={() => {
                          setEditingCampaign(c);
                          setEditCampaignName(c.name);
                          setEditCampaignBudget(String(c.budget));
                        }}
                        title="Edit Campaign"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {/* Delete Campaign Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                        onClick={() => handleDeleteCampaign(c.id, c.name)}
                        title="Delete Campaign"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Branch Management */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Building className="h-4 w-4 text-primary" />
            <span>Operational Branches</span>
          </div>
        </div>

        {isAdmin && (
          <form onSubmit={handleAddBranch} className="mt-4 flex flex-wrap gap-2">
            <Input
              placeholder="Branch Name (e.g. Tamale Branch)..."
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="h-9 w-48 text-xs sm:w-64"
              required
            />
            <Input
              placeholder="Location (e.g. Northern Region)..."
              value={newBranchLocation}
              onChange={(e) => setNewBranchLocation(e.target.value)}
              className="h-9 w-44 text-xs"
            />
            <Button type="submit" size="sm" className="h-9 gap-1.5 cursor-pointer font-semibold" disabled={addingBranch}>
              <Plus className="h-4 w-4" /> {addingBranch ? "Adding..." : "Add Branch"}
            </Button>
          </form>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {branches.map((b) => {
            const isAllotted = currentUser?.branchId === b.id;
            return (
              <div key={b.id} className={`flex items-center justify-between rounded-xl border p-3 text-xs ${isAllotted ? "border-primary/50 bg-primary/5" : "bg-background"}`}>
                <div className="min-w-0 pr-2">
                  <div className="font-semibold truncate">{b.name}</div>
                  <div className="text-muted-foreground truncate">{b.location || "Active Regional Branch"}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline">Active</Badge>
                  {isAdmin && (
                    <>
                      {/* Edit Branch Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={() => {
                          setEditingBranch(b);
                          setEditBranchName(b.name);
                          setEditBranchLocation(b.location || "");
                        }}
                        title="Edit Branch"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {/* Delete Branch Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                        onClick={() => handleDeleteBranch(b.id, b.name)}
                        title="Delete Branch"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Preferences */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="text-sm font-semibold">Notifications & Workspace Preferences</div>
        <div className="mt-4 space-y-3">
          {[
            { label: "In-app notifications for activity logs", on: true },
            { label: "Email notifications for new assignments", on: true },
            { label: "Real-time updates for approvals", on: true },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-sm">{row.label}</span>
              <Switch defaultChecked={row.on} />
            </div>
          ))}
        </div>
      </section>

      {/* Edit Campaign Modal */}
      <Dialog open={!!editingCampaign} onOpenChange={(val) => !val && setEditingCampaign(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handleSaveEditCampaign}>
            <DialogHeader>
              <DialogTitle className="font-bold">Edit Campaign</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground uppercase">Campaign Name</label>
                <Input
                  required
                  placeholder="Campaign Name..."
                  value={editCampaignName}
                  onChange={(e) => setEditCampaignName(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <label className="font-semibold text-muted-foreground uppercase">Budget ($)</label>
                <Input
                  type="number"
                  placeholder="Budget ($)"
                  value={editCampaignBudget}
                  onChange={(e) => setEditCampaignBudget(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingCampaign(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={savingCampaign} className="font-semibold">
                {savingCampaign ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Modal */}
      <Dialog open={!!editingBranch} onOpenChange={(val) => !val && setEditingBranch(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handleSaveEditBranch}>
            <DialogHeader>
              <DialogTitle className="font-bold">Edit Operational Branch</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground uppercase">Branch Name</label>
                <Input
                  required
                  placeholder="Branch Name..."
                  value={editBranchName}
                  onChange={(e) => setEditBranchName(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <label className="font-semibold text-muted-foreground uppercase">Location / Region</label>
                <Input
                  placeholder="Location / Region..."
                  value={editBranchLocation}
                  onChange={(e) => setEditBranchLocation(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingBranch(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={savingBranch} className="font-semibold">
                {savingBranch ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}