import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Upload, Link2, Image as ImageIcon, Sparkles, DollarSign, Users, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ActivityTable } from "@/components/activity-table";
import { useStore } from "@/lib/store";
import type { Activity } from "@/lib/store";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CHANNELS } from "@/lib/mock-data";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Marketing Activity — Zexpand" },
      { name: "description", content: "Every post, ad, and field visit across the team." },
      { property: "og:title", content: "Marketing Activity" },
      { property: "og:description", content: "Filter, drill in, and act on real marketing work." },
    ],
  }),
  component: ActivityPage,
});

const APPROACH_PRESETS = [
  "Organic Post",
  "Paid Ad / Meta Ads",
  "Group Post / Community",
  "Reel / Short Video",
  "Story / Status Update",
  "Field Visit / Event Outreach",
  "Email Broadcast",
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

function ActivityPage() {
  const { currentUser, activities, campaigns, branches, logActivity, updateActivity } = useStore();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit Activity State
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

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

  // Proof Upload State
  const [proofMode, setProofMode] = useState<"url" | "upload">("url");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Dropdown & Custom Text State
  const [approachSelect, setApproachSelect] = useState("");
  const [customApproach, setCustomApproach] = useState("");

  const [destinationSelect, setDestinationSelect] = useState("");
  const [customDestination, setCustomDestination] = useState("");

  const [form, setForm] = useState({
    campaign: "",
    channel: "",
    branchId: "",
    proofUrl: "",
    publishedLink: "",
    content: "",
    summary: "",
    cost: "",
    leads: "",
    clients: "",
  });

  const resetForm = () => {
    setEditingActivity(null);
    setForm({
      campaign: !isElevatedRole && (currentUser as any)?.campaignName ? (currentUser as any)?.campaignName : (campaignOptions[0] || ""),
      channel: "",
      branchId: !isElevatedRole && currentUser?.branchId ? currentUser.branchId : (availableBranches[0]?.id || ""),
      proofUrl: "",
      publishedLink: "",
      content: "",
      summary: "",
      cost: "",
      leads: "",
      clients: "",
    });
    setApproachSelect("");
    setCustomApproach("");
    setDestinationSelect("");
    setCustomDestination("");
    setProofMode("url");
    setSelectedFile(null);
    setFilePreview(null);
  };

  const handleOpenEditModal = (act: Activity) => {
    setEditingActivity(act);
    setForm({
      campaign: act.campaign || "",
      channel: act.channel || "",
      branchId: act.branchId || "",
      proofUrl: act.proof || "",
      publishedLink: act.publishedLink || "",
      content: act.content || "",
      summary: act.summary || "",
      cost: String(act.cost ?? 0),
      leads: String(act.leads ?? 0),
      clients: String(act.clients ?? 0),
    });

    if (APPROACH_PRESETS.includes(act.approach as any)) {
      setApproachSelect(act.approach);
      setCustomApproach("");
    } else {
      setApproachSelect("Other");
      setCustomApproach(act.approach || "");
    }

    if (DESTINATION_PRESETS.includes(act.destination as any)) {
      setDestinationSelect(act.destination);
      setCustomDestination("");
    } else {
      setDestinationSelect("Other");
      setCustomDestination(act.destination || "");
    }

    setProofMode("url");
    setSelectedFile(null);
    setFilePreview(null);
    setOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10 MB limit.");
      e.target.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Activity proof upload requires an image or screenshot file (PNG, JPG, WebP, GIF).");
      e.target.value = "";
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Final Approach & Destination resolution
    const finalApproach = approachSelect === "Other" ? customApproach.trim() : approachSelect;
    const finalDestination = destinationSelect === "Other" ? customDestination.trim() : destinationSelect;

    // MANDATORY PROOF VALIDATION
    const finalProof = proofMode === "url" ? form.proofUrl.trim() : filePreview;

    if (!finalProof) {
      toast.error("Proof image / screenshot is REQUIRED to log an activity.");
      return;
    }

    if (!form.content.trim()) {
      toast.error("Please describe the activity content.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        campaign: form.campaign || (campaignOptions[0] ?? "General"),
        channel: form.channel || (CHANNELS[0] ?? "Facebook"),
        branchId: form.branchId || currentUser?.branchId || "b-accra",
        approach: finalApproach || "Organic Post",
        destination: finalDestination || "Social Media",
        proofUrl: finalProof,
        publishedLink: form.publishedLink.trim() || undefined,
        content: form.content.trim(),
        summary: form.summary || form.content.substring(0, 100),
        cost: Number(form.cost) || 0,
        leads: Number(form.leads) || 0,
        clients: Number(form.clients) || 0,
      };

      if (editingActivity) {
        await updateActivity(editingActivity.id, payload);
        toast.success("Activity updated successfully!");
      } else {
        await logActivity(payload);
        toast.success("Activity logged successfully with verified proof!");
      }

      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to save activity");
    } finally {
      setSubmitting(false);
    }
  };

  const activeProofPreview = proofMode === "url" ? form.proofUrl : filePreview;

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title="Marketing Activity"
        description={`${activities.length} marketing activities logged`}
        actions={
          <Button
            size="sm"
            className="gap-1.5 cursor-pointer font-semibold shadow-md hover:shadow-lg transition-all"
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Log activity
          </Button>
        }
      />
      <ActivityTable activities={activities} onEditActivity={handleOpenEditModal} />

      <Dialog open={open} onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto p-0 rounded-2xl border bg-card shadow-2xl">
          <form onSubmit={handleSubmit}>
            {/* Modal Header */}
            <div className="relative border-b bg-muted/40 px-6 py-5">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">
                    {editingActivity ? "Edit Marketing Activity" : "Log Marketing Activity"}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    {editingActivity
                      ? "Update marketing activity details, proof & performance metrics."
                      : "Record campaign execution with required proof & performance metrics."}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 p-6 text-xs">
              {/* Section 1: Campaign & Strategy */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <span>1. Strategy & Targeting</span>
                </div>

                {/* Campaign & Channel */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-muted-foreground">CAMPAIGN</label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs shadow-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      value={form.campaign}
                      onChange={(e) => setForm({ ...form, campaign: e.target.value })}
                    >
                      <option value="">-- Select Campaign --</option>
                      {campaignOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground">CHANNEL</label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs shadow-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      value={form.channel}
                      onChange={(e) => setForm({ ...form, channel: e.target.value })}
                    >
                      <option value="">-- Select Channel --</option>
                      {CHANNELS.map((ch) => (
                        <option key={ch} value={ch}>{ch}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Operational Branch & Approach Dropdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-muted-foreground">OPERATIONAL BRANCH</label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs shadow-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      value={form.branchId}
                      onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                    >
                      <option value="">-- Select Branch --</option>
                      {availableBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground">APPROACH</label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs shadow-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      value={approachSelect}
                      onChange={(e) => setApproachSelect(e.target.value)}
                    >
                      <option value="">-- Select Approach --</option>
                      {APPROACH_PRESETS.map((ap) => (
                        <option key={ap} value={ap}>{ap}</option>
                      ))}
                    </select>
                    {approachSelect === "Other" && (
                      <Input
                        required
                        placeholder="Specify Custom Approach..."
                        value={customApproach}
                        onChange={(e) => setCustomApproach(e.target.value)}
                        className="h-9 text-xs rounded-lg mt-2"
                      />
                    )}
                  </div>
                </div>

                {/* Destination Platform Dropdown */}
                <div>
                  <label className="font-semibold text-muted-foreground">Page Name / Destination</label>
                  <select
                    className="mt-1 flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs shadow-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    value={destinationSelect}
                    onChange={(e) => setDestinationSelect(e.target.value)}
                  >
                    <option value="">-- Select Destination --</option>
                    {DESTINATION_PRESETS.map((dp) => (
                      <option key={dp} value={dp}>{dp}</option>
                    ))}
                  </select>
                  {destinationSelect === "Other" && (
                    <Input
                      required
                      placeholder="Specify Custom Destination Platform / Page..."
                      value={customDestination}
                      onChange={(e) => setCustomDestination(e.target.value)}
                      className="h-9 text-xs rounded-lg mt-2"
                    />
                  )}
                </div>
              </div>

              {/* Section 2: MANDATORY PROOF VERIFICATION */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span>2. Activity Proof Verification * (Required)</span>
                  </div>
                  {/* Proof Toggle */}
                  <div className="flex rounded-lg border bg-background p-0.5">
                    <button
                      type="button"
                      onClick={() => setProofMode("url")}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${proofMode === "url" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      <Link2 className="h-3 w-3" /> By URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setProofMode("upload")}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${proofMode === "upload" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      <Upload className="h-3 w-3" /> Direct Upload
                    </button>
                  </div>
                </div>

                {proofMode === "url" ? (
                  <div>
                    <Input
                      required
                      placeholder="Paste Image URL / Screenshot URL * (Required)..."
                      value={form.proofUrl}
                      onChange={(e) => setForm({ ...form, proofUrl: e.target.value })}
                      className="h-9 text-xs rounded-lg bg-background"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="flex min-h-[85px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-input bg-background p-3 text-center transition-colors hover:border-primary">
                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="font-semibold text-foreground text-xs">
                        {selectedFile ? selectedFile.name : "Click to select proof screenshot or image"}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">PNG, JPG, WebP up to 10 MB</span>
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>
                )}

                {/* Live Proof Thumbnail Preview */}
                {activeProofPreview && (
                  <div className="flex items-center gap-3 rounded-lg border bg-background p-2">
                    <img
                      src={activeProofPreview}
                      alt="Proof Preview"
                      className="h-12 w-16 rounded-md object-cover border shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-emerald-500 text-xs flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Proof Preview Attached
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[340px]">
                        {activeProofPreview}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="font-semibold text-muted-foreground">PUBLISHED LINK (OPTIONAL)</label>
                  <Input
                    placeholder="https://facebook.com/posts/12345..."
                    value={form.publishedLink}
                    onChange={(e) => setForm({ ...form, publishedLink: e.target.value })}
                    className="h-9 text-xs rounded-lg bg-background mt-1"
                  />
                </div>
              </div>

              {/* Section 3: Content / Copy */}
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground uppercase">3. Activity Description & Copy *</label>
                <textarea
                  required
                  rows={3}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-xs shadow-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="Describe the post, campaign copy, or field activity..."
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>

              {/* Section 4: Performance Metrics */}
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  4. Performance Metrics
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" /> COST ($)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={form.cost}
                      onChange={(e) => setForm({ ...form, cost: e.target.value })}
                      className="h-9 text-xs rounded-lg mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-blue-500" /> LEADS
                    </label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={form.leads}
                      onChange={(e) => setForm({ ...form, leads: e.target.value })}
                      className="h-9 text-xs rounded-lg mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground flex items-center gap-1">
                      <UserCheck className="h-3.5 w-3.5 text-amber-500" /> CLIENTS
                    </label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={form.clients}
                      onChange={(e) => setForm({ ...form, clients: e.target.value })}
                      className="h-9 text-xs rounded-lg mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t bg-muted/20 px-6 py-4 flex items-center justify-end gap-2.5">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="rounded-lg">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="rounded-lg font-semibold px-5 shadow-sm">
                {submitting
                  ? editingActivity
                    ? "Updating Activity..."
                    : "Saving Activity..."
                  : editingActivity
                  ? "Update Activity"
                  : "Save Activity"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}