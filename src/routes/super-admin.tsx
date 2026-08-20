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
import {
  getOrganizationsApi,
  createOrganizationApi,
  updateOrgStatusApi,
  getWorkspaceRequestsApi,
  approveWorkspaceRequestApi,
  rejectWorkspaceRequestApi,
} from "@/lib/api";

export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "SaaS Super Admin Portal — Zexpand" },
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

interface WorkspaceRequestItem {
  id: string;
  organizationName: string;
  organizationSlug: string;
  applicantUserId: string;
  applicantEmail: string;
  applicantName: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  createdAt: string;
}

function SuperAdminPage() {
  const { currentUser } = useStore();
  const navigate = useNavigate();

  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [requests, setRequests] = useState<WorkspaceRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [activeTab, setActiveTab] = useState<"instances" | "requests">("instances");

  // Reject Modal State
  const [rejectingReq, setRejectingReq] = useState<WorkspaceRequestItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);

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
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [orgsData, reqsData] = await Promise.all([
        getOrganizationsApi().catch(() => []),
        getWorkspaceRequestsApi().catch(() => []),
      ]);
      setOrgs(orgsData);
      setRequests(reqsData);
    } catch (err: any) {
      toast.error(err.message || "Failed to load platform data.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (reqItem: WorkspaceRequestItem) => {
    setProcessingReqId(reqItem.id);
    try {
      const res = await approveWorkspaceRequestApi(reqItem.id);
      toast.success(
        `Workspace '${reqItem.organizationName}' approved!${
          res.emailSent ? " Approval email sent to " + reqItem.applicantEmail : ""
        }`
      );
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve workspace request");
    } finally {
      setProcessingReqId(null);
    }
  };

  const handleConfirmRejectRequest = async () => {
    if (!rejectingReq) return;
    setProcessingReqId(rejectingReq.id);
    try {
      const res = await rejectWorkspaceRequestApi(rejectingReq.id, rejectionReason);
      toast.success(
        `Request for '${rejectingReq.organizationName}' declined.${
          res.emailSent ? " Rejection notice emailed." : ""
        }`
      );
      setRejectingReq(null);
      setRejectionReason("");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject workspace request");
    } finally {
      setProcessingReqId(null);
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
      loadData();
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

  const pendingRequests = requests.filter((r) => r.status === "pending");

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* Responsive Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
            SaaS Platform Super Admin Portal
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Review workspace requests, provision & manage isolated MarketOps client workspace instances across organizations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-2 cursor-pointer font-bold shadow-md hover:shadow-lg transition-all rounded-xl w-full sm:w-auto shrink-0 justify-center"
            onClick={() => setOpenModal(true)}
          >
            <Plus className="h-4 w-4" /> Provision Client Workspace
          </Button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-card/60 p-4 backdrop-blur-md shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1 text-xs font-semibold">
            <span>Pending Requests</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-500">{pendingRequests.length}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Awaiting Super Admin review</p>
        </div>

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

      {/* Main Container with Tab Switcher */}
      <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
        {/* Top Tab Switcher */}
        <div className="border-b bg-muted/40 px-4 pt-3 flex items-center gap-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab("instances")}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "instances"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Active Workspaces ({orgs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("requests")}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "requests"
                ? "border-amber-500 text-amber-500"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Pending Requests</span>
            {pendingRequests.length > 0 && (
              <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 h-4 font-black rounded-full animate-pulse">
                {pendingRequests.length}
              </Badge>
            )}
          </button>
        </div>

        {/* TAB 1: WORKSPACE INSTANCES */}
        {activeTab === "instances" && (
          <>
            <div className="p-4 border-b bg-muted/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <h3 className="text-xs font-bold">Client Workspace Instances</h3>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <div className="flex rounded-xl border bg-background p-0.5 text-xs font-medium w-full sm:w-auto justify-between sm:justify-start">
                  <button
                    className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg transition-all text-center ${
                      statusFilter === "all" ? "bg-primary text-primary-foreground font-bold shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setStatusFilter("all")}
                  >
                    All ({orgs.length})
                  </button>
                  <button
                    className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg transition-all text-center ${
                      statusFilter === "active" ? "bg-emerald-600 text-white font-bold shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setStatusFilter("active")}
                  >
                    Active ({activeCount})
                  </button>
                  <button
                    className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg transition-all text-center ${
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
                    className="h-8 pl-8 text-xs rounded-xl bg-background w-full"
                  />
                </div>
              </div>
            </div>

        {/* Mobile View: Cards (< 640px) */}
        <div className="divide-y block sm:hidden">
          {loading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading SaaS client instances...</div>
          ) : filteredOrgs.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No organizations found matching "{search}".</div>
          ) : (
            filteredOrgs.map((org) => {
              const inviteUrl = `${window.location.origin}/register?orgId=${org.id}`;
              const isRegistered = (org.userCount || 0) > 0;

              return (
                <div key={org.id} className="p-4 space-y-3 bg-card">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary font-bold text-xs uppercase shadow-2xs">
                        {org.name.substring(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{org.name}</span>
                          {org.id === "org-default" && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-primary/40 text-primary whitespace-nowrap shrink-0">
                              Primary Default
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                          <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{org.slug}.marketops.app</span>
                        </div>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={
                        org.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold shrink-0"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-bold shrink-0"
                      }
                    >
                      {org.status.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Owner & Registration */}
                  <div className="rounded-xl bg-muted/40 p-2.5 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-foreground font-medium truncate">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{org.ownerEmail || "Not Provided"}</span>
                    </div>
                    <div className="text-[10px]">
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
                  </div>

                  {/* Metrics Badge */}
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
                    <div>Users: <span className="text-foreground font-bold">{org.userCount || 0}</span></div>
                    <div>Leads: <span className="text-foreground font-bold">{org.leadCount || 0}</span></div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5 rounded-xl font-bold w-full"
                      onClick={() => copyToClipboard(inviteUrl, org.id)}
                    >
                      {copiedId === org.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedId === org.id ? "Copied" : "Copy Invite"}</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className={
                        org.status === "active"
                          ? "h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 text-xs gap-1.5 rounded-xl font-bold w-full border border-rose-500/20"
                          : "h-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 text-xs gap-1.5 rounded-xl font-bold w-full border border-emerald-500/20"
                      }
                      onClick={() => setConfirmingOrg({ org, action: org.status === "active" ? "suspend" : "activate" })}
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>{org.status === "active" ? "Suspend" : "Activate"}</span>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Table (>= 640px) */}
        <div className="hidden sm:block overflow-x-auto">
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
      </>
      )}

      {/* TAB 2: PENDING REQUESTS */}
      {activeTab === "requests" && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
              <h3 className="text-xs font-bold">Admin Workspace Requests Awaiting Super Admin Review</h3>
            </div>
          </div>

          {requests.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground bg-muted/10 rounded-2xl border border-dashed">
              No workspace requests have been submitted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((reqItem) => {
                const isPending = reqItem.status === "pending";
                const isApproved = reqItem.status === "approved";
                const isRejected = reqItem.status === "rejected";

                return (
                  <div
                    key={reqItem.id}
                    className="rounded-2xl border bg-card p-4 shadow-xs space-y-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-bold text-xs uppercase shadow-2xs ${
                          isPending
                            ? "bg-amber-500/10 text-amber-500"
                            : isApproved
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-rose-500/10 text-rose-500"
                        }`}
                      >
                        {reqItem.organizationName.substring(0, 2)}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground">{reqItem.organizationName}</span>
                          <Badge
                            variant="outline"
                            className={
                              isPending
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold"
                                : isApproved
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-bold"
                            }
                          >
                            {reqItem.status.toUpperCase()}
                          </Badge>
                        </div>

                        <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                          <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span>{reqItem.organizationSlug}.marketops.app</span>
                        </div>

                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap pt-0.5">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Mail className="h-3 w-3 text-muted-foreground shrink-0" /> {reqItem.applicantName} ({reqItem.applicantEmail})
                          </span>
                          <span>•</span>
                          <span>Requested {new Date(reqItem.createdAt).toLocaleDateString()}</span>
                        </div>

                        {isRejected && reqItem.rejectionReason && (
                          <p className="text-[11px] text-rose-500 font-medium">Rejection Reason: {reqItem.rejectionReason}</p>
                        )}
                      </div>
                    </div>

                    {isPending && (
                      <div className="flex items-center gap-2 shrink-0 justify-end w-full sm:w-auto">
                        <Button
                          size="sm"
                          className="h-8 text-xs font-bold gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                          disabled={processingReqId === reqItem.id}
                          onClick={() => handleApproveRequest(reqItem)}
                        >
                          {processingReqId === reqItem.id ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          <span>Approve Workspace</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs font-bold gap-1.5 rounded-xl border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
                          disabled={processingReqId === reqItem.id}
                          onClick={() => setRejectingReq(reqItem)}
                        >
                          <Power className="h-3.5 w-3.5" />
                          <span>Decline</span>
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      </div>

      {/* Reject Request Dialog */}
      <Dialog open={!!rejectingReq} onOpenChange={(o) => !o && setRejectingReq(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-500 flex items-center gap-2">
              <Power className="h-5 w-5" /> Decline Workspace Request
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground">
              Are you sure you want to decline the workspace request for <strong className="text-foreground">{rejectingReq?.organizationName}</strong> ({rejectingReq?.applicantEmail})?
            </p>
            <div className="space-y-1.5">
              <label className="font-bold text-foreground">Rejection Reason (Emailed to applicant):</label>
              <Input
                placeholder="e.g. Incomplete company information"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setRejectingReq(null)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={processingReqId === rejectingReq?.id}
              onClick={handleConfirmRejectRequest}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              {processingReqId === rejectingReq?.id ? "Processing..." : "Confirm Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
