import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Plus,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Users,
  TrendingUp,
  Power,
  Search,
  MessageSquare,
  Globe,
  Mail,
  UserCheck,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { getOrganizationsApi, createOrganizationApi, updateOrgStatusApi } from "@/lib/api";

export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "SaaS Super Admin Portal — MarketOps" },
      { name: "description", content: "Standalone SaaS Super Admin Management Portal." },
    ],
  }),
  component: SuperAdminPage,
});

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  ownerEmail?: string;
  ownerName?: string;
  userCount?: number;
  leadCount?: number;
  createdAt: string;
}

function SuperAdminPage() {
  const { currentUser } = useStore();
  const navigate = useNavigate();

  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [isCustomSlug, setIsCustomSlug] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Result Modal State
  const [createdResult, setCreatedResult] = useState<{ org: OrgItem; inviteUrl: string; emailSent: boolean } | null>(null);
  const [confirmingOrg, setConfirmingOrg] = useState<{ org: OrgItem; action: "suspend" | "activate" } | null>(null);
  const [toggling, setToggling] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && currentUser.role !== "super_admin") {
      toast.error("Super Admin privileges required to access the Platform Portal.");
      navigate({ to: "/" });
      return;
    }
    loadOrgs();
  }, [currentUser]);

  const loadOrgs = async () => {
    setLoading(true);
    try {
      const data = await getOrganizationsApi();
      setOrgs(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load client instances.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast.error("Company / Client Name is required.");
      return;
    }
    if (!adminEmail.trim()) {
      toast.error("Client Admin Email is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createOrganizationApi({
        name: orgName.trim(),
        slug: orgSlug.trim() || undefined,
        adminEmail: adminEmail.trim(),
      });

      toast.success(`Fresh workspace instance for "${res.organization.name}" provisioned!`);
      setCreatedResult({
        org: res.organization,
        inviteUrl: res.inviteUrl,
        emailSent: res.emailSent,
      });
      setOpenModal(false);
      setOrgName("");
      setOrgSlug("");
      setIsCustomSlug(false);
      setAdminEmail("");
      loadOrgs();
    } catch (err: any) {
      toast.error(err.message || "Failed to provision workspace instance");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!confirmingOrg) return;
    const { org, action } = confirmingOrg;
    const nextStatus = action === "suspend" ? "suspended" : "active";

    setToggling(true);
    try {
      const res = await updateOrgStatusApi(org.id, nextStatus);
      toast.success(
        `Instance "${org.name}" is now ${nextStatus.toUpperCase()}.${
          res.emailSent ? " Notification email dispatched." : ""
        }`
      );
      setOrgs((prev) =>
        prev.map((o) => (o.id === org.id ? { ...o, status: nextStatus } : o))
      );
      setConfirmingOrg(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update instance status");
    } finally {
      setToggling(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Workspace Invite Link copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredOrgs = orgs.filter((o) => {
    const matchesSearch =
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.slug.toLowerCase().includes(search.toLowerCase()) ||
      (o.ownerEmail && o.ownerEmail.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" ? true : o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const activeCount = orgs.filter((o) => o.status === "active").length;
  const totalLeads = orgs.reduce((acc, o) => acc + (o.leadCount || 0), 0);
  const totalUsers = orgs.reduce((acc, o) => acc + (o.userCount || 0), 0);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title="SaaS Platform Super Admin Portal"
        description="Provision, monitor & manage isolated MarketOps client workspace instances across organizations."
        actions={
          <Button
            size="sm"
            className="gap-2 cursor-pointer font-bold shadow-md hover:shadow-lg transition-all rounded-xl"
            onClick={() => setOpenModal(true)}
          >
            <Plus className="h-4 w-4" /> Provision Client Workspace
          </Button>
        }
      />

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card/60 p-4 backdrop-blur-md shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1 text-xs font-semibold">
            <span>Provisioned Workspaces</span>
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black">{orgs.length}</div>
          <p className="text-[11px] text-emerald-500 mt-1 font-medium flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {activeCount} Active Client Instances
          </p>
        </div>

        <div className="rounded-2xl border bg-card/60 p-4 backdrop-blur-md shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1 text-xs font-semibold">
            <span>Total SaaS Users</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black">{totalUsers}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Across all client organizations</p>
        </div>

        <div className="rounded-2xl border bg-card/60 p-4 backdrop-blur-md shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1 text-xs font-semibold">
            <span>Global Leads Tracked</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black">{totalLeads}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Attributed marketing leads</p>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
        <div className="p-4 border-b bg-muted/20 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-bold">Client Workspace Instances</h3>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Filter tabs */}
            <div className="flex rounded-xl border bg-background p-0.5 text-xs font-medium">
              <button
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === "all" ? "bg-primary text-primary-foreground font-bold shadow-2xs" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setStatusFilter("all")}
              >
                All ({orgs.length})
              </button>
              <button
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === "active" ? "bg-emerald-600 text-white font-bold shadow-2xs" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setStatusFilter("active")}
              >
                Active ({activeCount})
              </button>
              <button
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === "suspended" ? "bg-rose-600 text-white font-bold shadow-2xs" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setStatusFilter("suspended")}
              >
                Suspended ({orgs.length - activeCount})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search organizations or admin..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-xl bg-background"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Company / Workspace</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Client Admin Email (Shared To)</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-center">Users</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-center">Leads</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                    Loading SaaS client instances...
                  </TableCell>
                </TableRow>
              ) : filteredOrgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                    No organizations found matching "{search}".
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrgs.map((org) => {
                  const inviteUrl = `${window.location.origin}/register?orgId=${org.id}`;
                  const isRegistered = (org.userCount || 0) > 0;

                  return (
                    <TableRow key={org.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary font-bold text-xs uppercase shadow-2xs">
                            {org.name.substring(0, 2)}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                              <span>{org.name}</span>
                              {org.id === "org-default" && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-primary/40 text-primary whitespace-nowrap shrink-0">
                                  Primary Default
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Globe className="h-3 w-3 text-muted-foreground" />
                              <span>{org.slug}.marketops.app</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs font-medium text-foreground">{org.ownerEmail || "Not Provided"}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          {isRegistered ? (
                            <span className="text-emerald-500 font-semibold flex items-center gap-1">
                              <UserCheck className="h-3 w-3" /> Admin Joined ({org.ownerName || "Active Owner"})
                            </span>
                          ) : (
                            <span className="text-amber-500 font-medium flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Pending Registration Signup
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-3.5">
                        <Badge
                          variant="outline"
                          className={
                            org.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-bold"
                          }
                        >
                          {org.status.toUpperCase()}
                        </Badge>
                      </TableCell>

                      <TableCell className="px-4 py-3.5 text-center text-xs font-bold">
                        {org.userCount || 0}
                      </TableCell>

                      <TableCell className="px-4 py-3.5 text-center text-xs font-bold">
                        {org.leadCount || 0}
                      </TableCell>

                      <TableCell className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] gap-1 rounded-lg font-bold"
                            onClick={() => copyToClipboard(inviteUrl, org.id)}
                          >
                            {copiedId === org.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            <span>{copiedId === org.id ? "Copied" : "Copy Invite"}</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className={
                              org.status === "active"
                                ? "h-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 text-[11px] gap-1 rounded-lg"
                                : "h-7 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 text-[11px] gap-1 rounded-lg"
                            }
                            onClick={() => setConfirmingOrg({ org, action: org.status === "active" ? "suspend" : "activate" })}
                          >
                            <Power className="h-3 w-3" />
                            <span>{org.status === "active" ? "Suspend" : "Activate"}</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Provision Instance Modal */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl p-6">
          <form onSubmit={handleCreateOrg}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Provision New Client Workspace Instance
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground uppercase text-[11px]">COMPANY / CLIENT NAME *</label>
                <Input
                  required
                  placeholder="e.g. Apex Media Group, Carezza Corp..."
                  value={orgName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOrgName(val);
                    if (!isCustomSlug) {
                      const auto = val
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-+|-+$/g, "");
                      setOrgSlug(auto);
                    }
                  }}
                  className="h-9 text-xs rounded-lg mt-1"
                  autoFocus
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground uppercase text-[11px]">WORKSPACE DOMAIN SLUG</label>
                <Input
                  placeholder="e.g. apex-media"
                  value={orgSlug}
                  onChange={(e) => {
                    setIsCustomSlug(true);
                    setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  }}
                  className="h-9 text-xs rounded-lg mt-1 font-mono"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Domain: {orgSlug || "slug"}.marketops.app</p>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground uppercase text-[11px]">CLIENT ADMIN EMAIL *</label>
                <Input
                  required
                  type="email"
                  placeholder="e.g. john@apexmedia.com (Sends 1-click invitation)"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="h-9 text-xs rounded-lg mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  An automated email with a 1-click Registration Link will be generated & sent for the client admin to create their clean workspace.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setOpenModal(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={submitting} className="rounded-xl font-bold px-4">
                {submitting ? "Provisioning..." : "Provision Instance"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Shareable Link Result Modal */}
      {createdResult && (
        <Dialog open={!!createdResult} onOpenChange={() => setCreatedResult(null)}>
          <DialogContent className="sm:max-w-[500px] rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-500">
                <Check className="h-5 w-5" /> Workspace Instance Created!
              </DialogTitle>
            </DialogHeader>

            <div className="py-3 space-y-3 text-xs">
              <p className="text-muted-foreground">
                Share this 1-click signup link with <strong>{createdResult.org.name}</strong> ({createdResult.org.ownerEmail}). Their workspace starts <strong>100% clean and isolated</strong>.
              </p>

              {createdResult.emailSent && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span>Automated welcome email with registration link successfully sent to {createdResult.org.ownerEmail}!</span>
                </div>
              )}

              <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">1-Click Signup Link</label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={createdResult.inviteUrl}
                    className="h-9 text-xs font-mono bg-background rounded-lg"
                  />
                  <Button
                    size="sm"
                    className="h-9 px-3 gap-1 rounded-lg font-bold"
                    onClick={() => copyToClipboard(createdResult.inviteUrl, "modal-link")}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Hello! Here is your official access link to set up your new ${createdResult.org.name} workspace on MarketOps:\n\n${createdResult.inviteUrl}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1"
                >
                  <Button variant="outline" className="w-full text-xs gap-1.5 rounded-xl border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10">
                    <MessageSquare className="h-3.5 w-3.5" /> Share via WhatsApp
                  </Button>
                </a>
              </div>
            </div>

            <DialogFooter>
              <Button size="sm" onClick={() => setCreatedResult(null)} className="rounded-xl font-bold">
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Suspend / Activate Confirmation Modal */}
      {confirmingOrg && (
        <Dialog open={!!confirmingOrg} onOpenChange={() => setConfirmingOrg(null)}>
          <DialogContent className="sm:max-w-[440px] rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className={`text-base font-bold flex items-center gap-2 ${confirmingOrg.action === "suspend" ? "text-rose-500" : "text-emerald-500"}`}>
                <Power className="h-5 w-5" />
                {confirmingOrg.action === "suspend" ? "Confirm Workspace Suspension" : "Confirm Workspace Reactivation"}
              </DialogTitle>
            </DialogHeader>

            <div className="py-3 space-y-3 text-xs">
              <p className="text-foreground font-medium">
                Are you sure you want to {confirmingOrg.action}{" "}
                <strong>"{confirmingOrg.org.name}"</strong> (<code>{confirmingOrg.org.slug}.marketops.app</code>)?
              </p>

              {confirmingOrg.action === "suspend" ? (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] leading-relaxed">
                  <strong>Warning:</strong> Suspending this workspace will immediately block all users ({confirmingOrg.org.userCount || 0} members) under <strong>{confirmingOrg.org.ownerEmail || "this workspace"}</strong> from logging into MarketOps. An automated notification email will be dispatched.
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] leading-relaxed">
                  Reactivating this workspace will restore full access for all team members under <strong>{confirmingOrg.org.ownerEmail || "this workspace"}</strong>. An automated notification email will be dispatched.
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmingOrg(null)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={toggling}
                onClick={handleConfirmToggleStatus}
                className={`rounded-xl font-bold ${
                  confirmingOrg.action === "suspend"
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                {toggling
                  ? "Processing..."
                  : confirmingOrg.action === "suspend"
                  ? "Confirm Suspend"
                  : "Confirm Reactivate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
