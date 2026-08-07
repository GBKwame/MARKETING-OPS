import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  Plus,
  Building,
  Megaphone,
  Trash2,
  ShieldCheck,
  UserCheck,
  UserCog,
  ShieldAlert,
  Send,
  MessageSquare,
  Copy,
  Check,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useStore, Member, Role } from "@/lib/store";
import { toast } from "sonner";
import { createBranchApi, createCampaignApi } from "@/lib/api";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team Management — MarketOps" },
      { name: "description", content: "Manage team members, branches, campaigns, invitations and role privileges." },
      { property: "og:title", content: "Team Management" },
      { property: "og:description", content: "Scoped team administration." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const {
    currentUser,
    members,
    branches,
    campaigns,
    inviteTeamMember,
    deleteTeamMember,
    promoteTeamMember,
    refreshData,
  } = useStore();

  const role = currentUser?.role || "marketer";
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isMarketer = role === "marketer";

  // Modal States
  const [openInviteModal, setOpenInviteModal] = useState(false);
  const [openBranchModal, setOpenBranchModal] = useState(false);
  const [openCampaignModal, setOpenCampaignModal] = useState(false);

  // Invite Success Modal State
  const [inviteSuccessData, setInviteSuccessData] = useState<{
    emailSent: boolean;
    whatsappUrl: string;
    inviteMessage: string;
    userName: string;
    userEmail: string;
    role: string;
  } | null>(null);

  // Promotion Modal State
  const [promotingMember, setPromotingMember] = useState<Member | null>(null);
  const [targetRole, setTargetRole] = useState<Role>("manager");
  const [promoteBranchId, setPromoteBranchId] = useState("");
  const [promoteCampaignId, setPromoteCampaignId] = useState("");
  const [promoting, setPromoting] = useState(false);

  // Delete Member State
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Invite Form State
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: (isManager ? "marketer" : "manager") as "manager" | "marketer",
    branchId: branches[0]?.id || "",
    campaignId: campaigns[0]?.id || "",
  });
  const [inviting, setInviting] = useState(false);

  // Create Branch Form State
  const [branchName, setBranchName] = useState("");
  const [branchLocation, setBranchLocation] = useState("");
  const [creatingBranch, setCreatingBranch] = useState(false);

  // Create Campaign Form State
  const [campaignName, setCampaignName] = useState("");
  const [campaignDesc, setCampaignDesc] = useState("");
  const [campaignBudget, setCampaignBudget] = useState("");
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  const [copiedMessage, setCopiedMessage] = useState(false);

  // Marketer Access Restriction Notice
  if (isMarketer) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-xl font-bold">Access Restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Team administration and member invitations are reserved for Admins and Managers.
        </p>
        <div className="mt-6">
          <Button asChild size="sm">
            <Link to="/">Return to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Handle Invite Submission
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }

    setInviting(true);
    try {
      const res = await inviteTeamMember({
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim(),
        phone: inviteForm.phone.trim(),
        role: inviteForm.role,
        branchId: inviteForm.branchId || branches[0]?.id || undefined,
        campaignId: inviteForm.campaignId || campaigns[0]?.id || undefined,
      });

      toast.success(`Invitation generated for ${inviteForm.name}!`);
      setOpenInviteModal(false);

      // Open Success & Distribution Modal
      setInviteSuccessData({
        emailSent: res.emailSent,
        whatsappUrl: res.whatsappUrl,
        inviteMessage: res.inviteMessage,
        userName: inviteForm.name.trim(),
        userEmail: inviteForm.email.trim(),
        role: inviteForm.role,
      });

      setInviteForm({
        name: "",
        email: "",
        phone: "",
        role: isManager ? "marketer" : "manager",
        branchId: branches[0]?.id || "",
        campaignId: campaigns[0]?.id || "",
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation.");
    } finally {
      setInviting(false);
    }
  };

  // Handle Create Branch (ADMIN ONLY)
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) {
      toast.error("Branch name is required.");
      return;
    }

    setCreatingBranch(true);
    try {
      await createBranchApi({
        name: branchName.trim(),
        location: branchLocation.trim() || undefined,
      });
      await refreshData();
      toast.success(`Branch "${branchName}" created successfully!`);
      setOpenBranchModal(false);
      setBranchName("");
      setBranchLocation("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create branch.");
    } finally {
      setCreatingBranch(false);
    }
  };

  // Handle Create Campaign (ADMIN ONLY)
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim()) {
      toast.error("Campaign name is required.");
      return;
    }

    setCreatingCampaign(true);
    try {
      await createCampaignApi({
        name: campaignName.trim(),
        description: campaignDesc.trim() || undefined,
        budget: Number(campaignBudget) || 0,
      });
      await refreshData();
      toast.success(`Campaign "${campaignName}" created successfully!`);
      setOpenCampaignModal(false);
      setCampaignName("");
      setCampaignDesc("");
      setCampaignBudget("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create campaign.");
    } finally {
      setCreatingCampaign(false);
    }
  };

  // Handle Promote / Upgrade Submission (ADMIN ONLY)
  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promotingMember) return;

    setPromoting(true);
    try {
      await promoteTeamMember(promotingMember.id, {
        targetRole,
        branchId: targetRole === "manager" ? promoteBranchId || branches[0]?.id : undefined,
        campaignId: targetRole === "manager" ? promoteCampaignId || campaigns[0]?.id : undefined,
      });

      toast.success(
        `Role updated for ${promotingMember.name}! Role is now ${targetRole.toUpperCase()}.`
      );
      setPromotingMember(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update member role.");
    } finally {
      setPromoting(false);
    }
  };

  // Handle Delete / Revoke Submission
  const handleConfirmDelete = async () => {
    if (!memberToDelete) return;
    setDeleting(true);
    try {
      await deleteTeamMember(memberToDelete.id);
      toast.success(`Revoked all permissions for ${memberToDelete.name}.`);
      setMemberToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke member.");
    } finally {
      setDeleting(false);
    }
  };

  const roleBadge = (mRole: Role) => {
    if (mRole === "admin") {
      return (
        <Badge variant="default" className="gap-1 bg-primary text-primary-foreground font-semibold px-2.5 py-0.5 text-xs">
          <ShieldCheck className="h-3 w-3" /> Admin
        </Badge>
      );
    }
    if (mRole === "manager") {
      return (
        <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold px-2.5 py-0.5 text-xs">
          <UserCheck className="h-3 w-3" /> Manager
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold px-2.5 py-0.5 text-xs">
        <Users className="h-3 w-3" /> Marketer
      </Badge>
    );
  };

  const invitationBadge = (status?: string) => {
    if (status === "pending") {
      return (
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold">
          Pending Invite
        </Badge>
      );
    }
    if (status === "revoked") {
      return (
        <Badge variant="destructive" className="text-[11px] font-bold">
          Revoked
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
        Accepted
      </Badge>
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title="Team Management"
        description="Centralized administration for workspace members, invitations, branch & campaign scoping."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* ONLY ADMIN CAN CREATE BRANCH & CAMPAIGN */}
            {isAdmin && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 font-semibold cursor-pointer shadow-2xs"
                  onClick={() => setOpenBranchModal(true)}
                >
                  <Building className="h-4 w-4 text-primary" /> Create Branch
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 font-semibold cursor-pointer shadow-2xs"
                  onClick={() => setOpenCampaignModal(true)}
                >
                  <Megaphone className="h-4 w-4 text-primary" /> Create Campaign
                </Button>
              </>
            )}

            {/* ADMIN & MANAGER CAN INVITE */}
            <Button
              size="sm"
              className="gap-1.5 font-semibold shadow-md hover:shadow-lg cursor-pointer transition-all"
              onClick={() => {
                setInviteForm({
                  name: "",
                  email: "",
                  phone: "",
                  role: isManager ? "marketer" : "manager",
                  branchId: branches[0]?.id || "",
                  campaignId: campaigns[0]?.id || "",
                });
                setOpenInviteModal(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {isAdmin ? "Invite Member" : "Invite Marketer"}
            </Button>
          </div>
        }
      />

      {/* Team Table matching exact requested headers */}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b">
              <TableHead className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-4 py-3 min-w-[200px]">
                MEMBER NAME
              </TableHead>
              <TableHead className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-4 py-3 min-w-[140px]">
                INVITATION STATUS
              </TableHead>
              <TableHead className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-4 py-3 min-w-[160px]">
                CAMPAIGN NAME
              </TableHead>
              <TableHead className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-4 py-3 min-w-[150px]">
                BRANCH NAME
              </TableHead>
              <TableHead className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-4 py-3 min-w-[130px]">
                ROLE
              </TableHead>
              <TableHead className="text-right text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-4 py-3 min-w-[140px]">
                ACTION
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                  No team members found in your scoped view.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => {
                const isSelf = currentUser?.id === m.id;
                const canDelete =
                  !isSelf &&
                  (isAdmin || (isManager && m.role === "marketer"));

                return (
                  <TableRow key={m.id} className="hover:bg-muted/20 transition-colors">
                    {/* MEMBER NAME */}
                    <TableCell className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border shadow-2xs">
                          {m.picture ? (
                            <AvatarImage src={m.picture} alt={m.name} />
                          ) : null}
                          <AvatarFallback className="font-bold text-xs bg-primary/10 text-primary">
                            {m.avatar || m.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <span>{m.name}</span>
                            {isSelf && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1">
                                You
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{m.email}</div>
                        </div>
                      </div>
                    </TableCell>

                    {/* INVITATION STATUS */}
                    <TableCell className="px-4 py-3.5 whitespace-nowrap">
                      {invitationBadge(m.invitationStatus)}
                    </TableCell>

                    {/* CAMPAIGN NAME */}
                    <TableCell className="px-4 py-3.5 text-xs font-semibold text-foreground">
                      {m.campaignName || (m.role === "admin" ? "All Campaigns" : "General Campaign")}
                    </TableCell>

                    {/* BRANCH NAME */}
                    <TableCell className="px-4 py-3.5 text-xs text-muted-foreground">
                      {m.branchName || m.branch || (m.role === "admin" ? "Workspace HQ" : "Default Branch")}
                    </TableCell>

                    {/* ROLE */}
                    <TableCell className="px-4 py-3.5 whitespace-nowrap">
                      {roleBadge(m.role)}
                    </TableCell>

                    {/* ACTION */}
                    <TableCell className="text-right px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* ADMIN ONLY PROMOTION / ROLE MANAGEMENT BUTTON */}
                        {isAdmin && !isSelf && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-[120px] shrink-0 justify-center text-xs gap-1.5 font-semibold border-primary/30 hover:bg-primary/10 hover:text-primary rounded-lg cursor-pointer"
                            onClick={() => {
                              setPromotingMember(m);
                              setTargetRole(m.role === "marketer" ? "manager" : "admin");
                              setPromoteBranchId(m.branchId || branches[0]?.id || "");
                              setPromoteCampaignId(m.campaignId || campaigns[0]?.id || "");
                            }}
                          >
                            <UserCog className="h-3.5 w-3.5 text-primary shrink-0" />
                            Manage Role
                          </Button>
                        )}

                        {/* DELETE / REVOKE BUTTON */}
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                            title="Revoke Permissions & Delete Member"
                            onClick={() => setMemberToDelete(m)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* INVITATION MODAL */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={openInviteModal} onOpenChange={setOpenInviteModal}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl p-0 overflow-hidden border shadow-2xl">
          <form onSubmit={handleInviteSubmit}>
            <div className="border-b bg-muted/40 px-6 py-5">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">
                    {isAdmin ? "Invite Team Member" : "Invite Marketer"}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    Send real SMTP email invitation & generate instant WhatsApp join link.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground">FULL NAME *</label>
                <Input
                  required
                  placeholder="e.g. Kwame Mensah"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="h-9 text-xs rounded-lg mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground">EMAIL ADDRESS *</label>
                  <Input
                    required
                    type="email"
                    placeholder="kwame@company.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="h-9 text-xs rounded-lg mt-1"
                  />
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground">PHONE / WHATSAPP</label>
                  <Input
                    placeholder="+233 24 000 0000"
                    value={inviteForm.phone}
                    onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                    className="h-9 text-xs rounded-lg mt-1"
                  />
                </div>
              </div>

              {/* ROLE SELECT: ADMIN CAN SELECT MANAGER OR MARKETER; MANAGER ONLY MARKETER */}
              {isAdmin && (
                <div>
                  <label className="font-semibold text-muted-foreground">ROLE *</label>
                  <select
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-2xs mt-1 font-medium"
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as any })}
                  >
                    <option value="manager">Manager (Branch & Campaign Lead)</option>
                    <option value="marketer">Marketer (Executes Campaigns & Activity Logs)</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground">BRANCH *</label>
                  <select
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-2xs mt-1 font-medium"
                    value={inviteForm.branchId}
                    onChange={(e) => setInviteForm({ ...inviteForm, branchId: e.target.value })}
                  >
                    <option value="">Select Branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground">CAMPAIGN *</label>
                  <select
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-2xs mt-1 font-medium"
                    value={inviteForm.campaignId}
                    onChange={(e) => setInviteForm({ ...inviteForm, campaignId: e.target.value })}
                  >
                    <option value="">Select Campaign</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t bg-muted/20 px-6 py-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpenInviteModal(false)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={inviting} className="rounded-lg font-semibold px-5 shadow-sm">
                {inviting ? "Generating Invite..." : "Send Invitation"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* INVITATION SUCCESS & WHATSAPP DISTRIBUTION MODAL */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={!!inviteSuccessData} onOpenChange={() => setInviteSuccessData(null)}>
        <DialogContent className="sm:max-w-[520px] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-600">
              <Sparkles className="h-5 w-5" /> Member Invited Successfully!
            </DialogTitle>
          </DialogHeader>

          {inviteSuccessData && (
            <div className="space-y-4 py-2 text-xs">
              <p className="text-muted-foreground">
                Invitation created for <strong className="text-foreground">{inviteSuccessData.userName}</strong> (
                {inviteSuccessData.userEmail}) as <strong>{inviteSuccessData.role.toUpperCase()}</strong>.
              </p>

              {/* SMTP Email Status Alert */}
              <div className="rounded-xl border bg-emerald-500/10 p-3 flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 shrink-0" />
                  <span className="font-semibold">Nodemailer SMTP Email Status:</span>
                </div>
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/20 text-emerald-700 font-bold">
                  {inviteSuccessData.emailSent ? "Dispatched" : "Queued"}
                </Badge>
              </div>

              {/* WhatsApp Distribution Section */}
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between font-bold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-emerald-500" /> Send via WhatsApp
                  </span>
                  <Button
                    size="sm"
                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 rounded-lg"
                    onClick={() => window.open(inviteSuccessData.whatsappUrl, "_blank")}
                  >
                    Open WhatsApp <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="relative">
                  <textarea
                    readOnly
                    value={inviteSuccessData.inviteMessage}
                    className="w-full h-20 p-2.5 text-[11px] rounded-lg border bg-background text-muted-foreground font-mono resize-none focus:outline-none"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute right-2 bottom-2 h-7 text-[10px] gap-1 px-2 rounded-md"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteSuccessData.inviteMessage);
                      setCopiedMessage(true);
                      setTimeout(() => setCopiedMessage(false), 2000);
                      toast.success("Invitation message copied to clipboard!");
                    }}
                  >
                    {copiedMessage ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copiedMessage ? "Copied!" : "Copy Text"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button size="sm" onClick={() => setInviteSuccessData(null)} className="rounded-xl font-bold px-5">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* CREATE BRANCH MODAL (ADMIN ONLY) */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={openBranchModal} onOpenChange={setOpenBranchModal}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl p-6">
          <form onSubmit={handleCreateBranch}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" /> Create New Branch
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3.5 py-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground">BRANCH NAME *</label>
                <Input
                  required
                  placeholder="e.g. Kumasi Branch"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="h-9 text-xs rounded-lg mt-1"
                />
              </div>
              <div>
                <label className="font-semibold text-muted-foreground">LOCATION / ADDRESS</label>
                <Input
                  placeholder="e.g. Adum Commercial Area, Kumasi"
                  value={branchLocation}
                  onChange={(e) => setBranchLocation(e.target.value)}
                  className="h-9 text-xs rounded-lg mt-1"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpenBranchModal(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={creatingBranch} className="rounded-xl font-bold px-4">
                {creatingBranch ? "Creating..." : "Create Branch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* CREATE CAMPAIGN MODAL (ADMIN ONLY) */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={openCampaignModal} onOpenChange={setOpenCampaignModal}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl p-6">
          <form onSubmit={handleCreateCampaign}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" /> Create New Campaign
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3.5 py-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground">CAMPAIGN NAME *</label>
                <Input
                  required
                  placeholder="e.g. Q4 Caregiver Recruitment Drive"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="h-9 text-xs rounded-lg mt-1"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground">TOTAL BUDGET ($)</label>
                <Input
                  type="number"
                  placeholder="e.g. 5000"
                  value={campaignBudget}
                  onChange={(e) => setCampaignBudget(e.target.value)}
                  className="h-9 text-xs rounded-lg mt-1"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground">DESCRIPTION</label>
                <Input
                  placeholder="Brief overview of campaign targets..."
                  value={campaignDesc}
                  onChange={(e) => setCampaignDesc(e.target.value)}
                  className="h-9 text-xs rounded-lg mt-1"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpenCampaignModal(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={creatingCampaign} className="rounded-xl font-bold px-4">
                {creatingCampaign ? "Creating..." : "Create Campaign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* ROLE PROMOTION / UPGRADE MODAL (ADMIN ONLY) */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={!!promotingMember} onOpenChange={(val) => !val && setPromotingMember(null)}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl p-6">
          <form onSubmit={handlePromoteSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-primary">
                <UserCog className="h-5 w-5 text-primary" /> Manage Member Role
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              <p className="text-muted-foreground">
                Change <strong className="text-foreground">{promotingMember?.name}</strong> ({promotingMember?.email}) Role.
              </p>

              <div>
                <label className="font-semibold text-muted-foreground">TARGET ROLE *</label>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-2xs mt-1 font-bold"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as Role)}
                >
                  <option value="manager">Manager (Branch & Campaign Lead)</option>
                  <option value="admin">Admin (Full Workspace Control)</option>
                  <option value="marketer">Marketer (Standard Contributor)</option>
                </select>
              </div>

              {/* IF PROMOTING TO MANAGER, ADMIN SELECTS BRANCH & CAMPAIGN */}
              {targetRole === "manager" && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border bg-muted/20">
                  <div>
                    <label className="font-semibold text-muted-foreground">ASSIGNED BRANCH *</label>
                    <select
                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-2xs mt-1 font-medium"
                      value={promoteBranchId}
                      onChange={(e) => setPromoteBranchId(e.target.value)}
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-muted-foreground">ASSIGNED CAMPAIGN *</label>
                    <select
                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-2xs mt-1 font-medium"
                      value={promoteCampaignId}
                      onChange={(e) => setPromoteCampaignId(e.target.value)}
                    >
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPromotingMember(null)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={promoting} className="rounded-xl font-bold px-4">
                {promoting ? "Promoting..." : "Confirm Role Update"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* DELETE / REVOKE MEMBER DIALOG */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={!!memberToDelete} onOpenChange={(val) => !val && setMemberToDelete(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Revoke Member Access
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground">
            Are you sure you want to delete member <span className="font-bold text-foreground">"{memberToDelete?.name}"</span> ({memberToDelete?.email})? This will revoke all their workspace permissions.
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setMemberToDelete(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              className="rounded-xl font-bold px-4"
              onClick={handleConfirmDelete}
            >
              {deleting ? "Revoking..." : "Revoke Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
