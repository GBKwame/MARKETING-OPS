import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, UserCheck, Phone, Mail, Share2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LeadsTable } from "@/components/leads-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStore } from "@/lib/store";
import type { Lead } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CHANNELS } from "@/lib/mock-data";

export const Route = createFileRoute("/leads")({
  head: () => ({
    meta: [
      { title: "Leads — Zexpand" },
      { name: "description", content: "Every lead attributed to a marketing activity." },
      { property: "og:title", content: "Leads" },
      { property: "og:description", content: "Track leads, team attribution, channels, and campaigns." },
    ],
  }),
  component: LeadsPage,
});

const APPROACH_PRESETS = [
  "Organic Post",
  "Paid Ad / Sponsored",
  "Direct Outreach / DM",
  "Community Engagement",
  "Flyer Distribution",
  "WhatsApp Broadcast",
  "Other",
];

const DESTINATION_PRESETS = [
  "Facebook Main Page",
  "Facebook Group",
  "Instagram Main Handle",
  "Instagram Reels",
  "TikTok Profile",
  "LinkedIn Company Page",
  "WhatsApp Channel / Group",
  "YouTube Channel / Shorts",
  "Field Location / On-site",
  "Other",
];

function parseContactString(contactStr: string) {
  let phone = "";
  let email = "";
  let social = "";

  if (!contactStr) return { phone, email, social };

  const parts = contactStr.split(/\s*\|\s*/);
  parts.forEach((p) => {
    const clean = p.trim();
    if (clean.startsWith("📞") || clean.match(/^[+0-9\s-]{6,}$/)) {
      phone = clean.replace(/^📞\s*/, "");
    } else if (clean.startsWith("✉️") || (clean.includes("@") && clean.includes("."))) {
      email = clean.replace(/^✉️\s*/, "");
    } else if (clean.startsWith("🌐") || clean.startsWith("@") || clean.includes("instagram") || clean.includes("facebook")) {
      social = clean.replace(/^🌐\s*/, "");
    } else if (!phone) {
      phone = clean;
    } else if (!email) {
      email = clean;
    } else {
      social = clean;
    }
  });

  return { phone, email, social };
}

function LeadsPage() {
  const { currentUser, leads, campaigns, members, branches, createLead, updateLead, deleteLead, memberById } = useStore();

  const [open, setOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isElevatedRole = currentUser?.role === "admin" || currentUser?.role === "super_admin";

  // Filter Branches: Admins see all; Marketers & Managers only see their assigned branch
  const availableBranches = isElevatedRole
    ? branches
    : (currentUser?.branchId ? branches.filter((b) => b.id === currentUser.branchId) : branches);

  // Filter Campaigns: Admins see all; Marketers & Managers only see their assigned campaign
  const availableCampaigns = isElevatedRole
    ? campaigns
    : (currentUser?.campaignId || (currentUser as any)?.campaignName
        ? campaigns.filter((c) => c.id === currentUser?.campaignId || c.name === (currentUser as any)?.campaignName)
        : campaigns);

  const campaignOptions = availableCampaigns.map((c) => c.name);
  const defaultMember = currentUser?.id || members[0]?.id || "u-admin";
  const defaultBranch = !isElevatedRole && currentUser?.branchId ? currentUser.branchId : (availableBranches[0]?.id || "");

  // Dynamic Contact State
  const [contactType, setContactType] = useState<"phone" | "email" | "social">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [socialInput, setSocialInput] = useState("");

  // Dropdown & Custom Text State
  const [approachSelect, setApproachSelect] = useState("");
  const [customApproach, setCustomApproach] = useState("");
  const [destinationSelect, setDestinationSelect] = useState("");
  const [customDestination, setCustomDestination] = useState("");

  const [form, setForm] = useState({
    name: "",
    contact: "",
    campaign: "",
    channel: "",
    assignedToId: defaultMember,
    branchId: defaultBranch,
    notes: "",
  });

  const resetForm = () => {
    setEditingLead(null);
    setForm({
      name: "",
      contact: "",
      campaign: !isElevatedRole && (currentUser as any)?.campaignName ? (currentUser as any)?.campaignName : (campaignOptions[0] || ""),
      channel: "",
      assignedToId: defaultMember,
      branchId: defaultBranch,
      notes: "",
    });
    setContactType("phone");
    setPhoneInput("");
    setEmailInput("");
    setSocialInput("");
    setApproachSelect("");
    setCustomApproach("");
    setDestinationSelect("");
    setCustomDestination("");
  };

  const handleOpenEditModal = (l: Lead) => {
    setEditingLead(l);
    setForm({
      name: l.name || "",
      contact: l.contact || "",
      campaign: l.campaign || "",
      channel: l.channel || "",
      assignedToId: l.assignedToId || defaultMember,
      branchId: l.branchId || defaultBranch,
      notes: l.notes || "",
    });

    const parsed = parseContactString(l.contact || "");
    setPhoneInput(parsed.phone);
    setEmailInput(parsed.email);
    setSocialInput(parsed.social);

    if (parsed.phone) setContactType("phone");
    else if (parsed.email) setContactType("email");
    else if (parsed.social) setContactType("social");
    else setContactType("phone");

    if (APPROACH_PRESETS.includes(l.approach as any)) {
      setApproachSelect(l.approach || "");
      setCustomApproach("");
    } else {
      setApproachSelect("Other");
      setCustomApproach(l.approach || "");
    }

    if (DESTINATION_PRESETS.includes(l.destination as any)) {
      setDestinationSelect(l.destination || "");
      setCustomDestination("");
    } else {
      setDestinationSelect("Other");
      setCustomDestination(l.destination || "");
    }

    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Lead name is required.");
      return;
    }

    const hasPhone = phoneInput.trim().length > 0;
    const hasEmail = emailInput.trim().length > 0;
    const hasSocial = socialInput.trim().length > 0;

    if (!hasPhone && !hasEmail && !hasSocial) {
      toast.error("Please provide at least one contact method (Phone, Email, or Social Media).");
      return;
    }

    const contactParts: string[] = [];
    if (hasPhone) contactParts.push(`📞 ${phoneInput.trim()}`);
    if (hasEmail) contactParts.push(`✉️ ${emailInput.trim()}`);
    if (hasSocial) contactParts.push(`🌐 ${socialInput.trim()}`);

    const finalContact = contactParts.join(" | ");
    const finalApproach = approachSelect === "Other" ? customApproach.trim() : approachSelect;
    const finalDestination = destinationSelect === "Other" ? customDestination.trim() : destinationSelect;

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact: finalContact,
        campaign: form.campaign || campaignOptions[0] || "General",
        channel: form.channel || CHANNELS[0] || "Direct Outreach",
        approach: finalApproach || "Organic Post",
        destination: finalDestination || "Social Media",
        assignedToId: form.assignedToId || defaultMember,
        branchId: form.branchId || defaultBranch || undefined,
        notes: form.notes.trim(),
      };

      if (editingLead) {
        await updateLead(editingLead.id, payload);
        toast.success("Lead updated successfully!");
      } else {
        await createLead(payload);
        toast.success("New lead created successfully!");
      }

      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to save lead");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!leadToDelete) return;
    setDeleting(true);
    try {
      await deleteLead(leadToDelete.id);
      toast.success("Lead deleted successfully!");
      setLeadToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete lead");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <PageHeader
        title="Leads"
        description={`${leads.length} leads attributed to marketing activities`}
        actions={
          <Button
            size="sm"
            className="gap-1.5 cursor-pointer font-semibold shadow-md hover:shadow-lg transition-all"
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add lead
          </Button>
        }
      />

      <LeadsTable leads={leads} onEditLead={handleOpenEditModal} />

      {/* Add / Edit Lead Dialog */}
      <Dialog open={open} onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[580px] max-h-[90vh] overflow-y-auto p-0 rounded-2xl border bg-card shadow-2xl">
          <form onSubmit={handleSubmit}>
            <div className="relative border-b bg-muted/40 px-6 py-5">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">
                    {editingLead ? "Edit Lead Information" : "Add New Lead"}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    Record lead details with channel attribution, team assignment & remarks.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6 text-xs">
              {/* Name Field */}
              <div>
                <label className="font-semibold text-muted-foreground uppercase text-[11px]">LEAD NAME *</label>
                <Input
                  required
                  placeholder="Full name (e.g. Adjoa Mensah)"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-9 text-xs rounded-lg mt-1"
                />
              </div>

              {/* Dynamic Premium Contact Selector & Input Section */}
              <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <span>Contact Methods * (At least 1 required)</span>
                  </label>
                  {/* Contact Mode Selector Pills */}
                  <div className="flex rounded-lg border bg-background p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setContactType("phone")}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer",
                        contactType === "phone"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Phone className="h-3 w-3" /> Phone
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactType("email")}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer",
                        contactType === "email"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Mail className="h-3 w-3" /> Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactType("social")}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer",
                        contactType === "social"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Share2 className="h-3 w-3" /> Social
                    </button>
                  </div>
                </div>

                {/* Phone Input Mode */}
                {contactType === "phone" && (
                  <div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        inputMode="numeric"
                        placeholder="Enter phone number (e.g. +233 24 123 4567)..."
                        value={phoneInput}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/[^0-9+\s-]/g, "");
                          setPhoneInput(cleaned);
                        }}
                        className="h-9 text-xs pl-9 rounded-lg bg-background font-mono"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Accepts digits, country code (+) & spaces only.</p>
                  </div>
                )}

                {/* Email Input Mode */}
                {contactType === "email" && (
                  <div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="Enter email address (e.g. lead@company.com)..."
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="h-9 text-xs pl-9 rounded-lg bg-background"
                      />
                    </div>
                  </div>
                )}

                {/* Social Media Mode */}
                {contactType === "social" && (
                  <div>
                    <div className="relative">
                      <Share2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Enter social handle or link (e.g. @instagram, fb.com/name)..."
                        value={socialInput}
                        onChange={(e) => setSocialInput(e.target.value)}
                        className="h-9 text-xs pl-9 rounded-lg bg-background"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground">CAMPAIGN</label>
                  <select
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-2xs mt-1"
                    value={form.campaign}
                    onChange={(e) => setForm({ ...form, campaign: e.target.value })}
                  >
                    <option value="">Select Campaign</option>
                    {campaignOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-muted-foreground">CHANNEL</label>
                  <select
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-2xs mt-1"
                    value={form.channel}
                    onChange={(e) => setForm({ ...form, channel: e.target.value })}
                  >
                    <option value="">Select Channel</option>
                    {CHANNELS.map((ch) => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground">APPROACH</label>
                  <select
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-2xs mt-1"
                    value={approachSelect}
                    onChange={(e) => setApproachSelect(e.target.value)}
                  >
                    <option value="">Select Approach</option>
                    {APPROACH_PRESETS.map((ap) => (
                      <option key={ap} value={ap}>{ap}</option>
                    ))}
                  </select>
                  {approachSelect === "Other" && (
                    <Input
                      placeholder="Type custom approach..."
                      value={customApproach}
                      onChange={(e) => setCustomApproach(e.target.value)}
                      className="h-8 text-xs rounded-lg mt-1.5"
                    />
                  )}
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground">DESTINATION</label>
                  <select
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-2xs mt-1"
                    value={destinationSelect}
                    onChange={(e) => setDestinationSelect(e.target.value)}
                  >
                    <option value="">Select Destination</option>
                    {DESTINATION_PRESETS.map((dp) => (
                      <option key={dp} value={dp}>{dp}</option>
                    ))}
                  </select>
                  {destinationSelect === "Other" && (
                    <Input
                      placeholder="Type custom destination..."
                      value={customDestination}
                      onChange={(e) => setCustomDestination(e.target.value)}
                      className="h-8 text-xs rounded-lg mt-1.5"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground">TEAM MEMBER</label>
                  <select
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-2xs mt-1"
                    value={form.assignedToId}
                    onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-muted-foreground">BRANCH</label>
                  <select
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-2xs mt-1"
                    value={form.branchId}
                    onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  >
                    <option value="">Select Branch</option>
                    {availableBranches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground">COMMENTS / NOTES</label>
                <textarea
                  rows={3}
                  placeholder="Additional details, referral info, or prospect notes..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-xs shadow-2xs focus:border-primary focus:ring-1 focus:ring-primary transition-all mt-1"
                />
              </div>
            </div>

            <div className="border-t bg-muted/20 px-6 py-4 flex items-center justify-end gap-2.5">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="rounded-lg">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="rounded-lg font-semibold px-5 shadow-sm">
                {submitting
                  ? editingLead
                    ? "Updating..."
                    : "Creating..."
                  : editingLead
                  ? "Update Lead"
                  : "Create Lead"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!leadToDelete} onOpenChange={(val) => !val && setLeadToDelete(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Confirm Lead Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground">
            Are you sure you want to delete lead <span className="font-bold text-foreground">"{leadToDelete?.name}"</span> ({leadToDelete?.contact})? This action cannot be undone.
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setLeadToDelete(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              className="rounded-xl font-bold px-4"
              onClick={handleConfirmDelete}
            >
              {deleting ? "Deleting..." : "Delete Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}