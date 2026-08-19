import { useState, useEffect } from "react";
import { Building2, Sparkles, Clock, AlertCircle, RefreshCw, Send, CheckCircle2, ShieldCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { submitWorkspaceRequestApi, getMyWorkspaceRequestStatusApi } from "@/lib/api";
import { useStore } from "@/lib/store";

export function WorkspaceRequestView({ onApproved }: { onApproved?: () => void }) {
  const { currentUser, refreshData } = useStore();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);
  const [isApproved, setIsApproved] = useState(false);

  // Form State
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [isCustomSlug, setIsCustomSlug] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await getMyWorkspaceRequestStatusApi();
      if (res.isApproved) {
        setIsApproved(true);
        if (onApproved) onApproved();
        await refreshData();
      } else {
        setRequest(res.request || null);
      }
    } catch (err: any) {
      console.error("Failed to check workspace request status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleNameChange = (val: string) => {
    setCompanyName(val);
    if (!isCustomSlug) {
      const autoSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setSlug(autoSlug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error("Company / Workspace Name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitWorkspaceRequestApi({
        organizationName: companyName.trim(),
        organizationSlug: slug.trim() || undefined,
      });

      toast.success(
        `Request submitted! All Super Admins have been notified${
          res.emailSent ? " via email." : "."
        }`
      );
      setRequest(res.request);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit workspace request");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-xs font-semibold text-muted-foreground">Checking workspace status...</p>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // SCENARIO 1: PENDING APPROVAL SCREEN
  // ------------------------------------------------------------------
  if (request && request.status === "pending") {
    return (
      <div className="mx-auto max-w-xl py-12 px-4 space-y-6">
        <div className="rounded-3xl border bg-card p-6 sm:p-8 shadow-lg text-center space-y-6">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-500/10 text-amber-500 ring-8 ring-amber-500/5">
            <Clock className="h-8 w-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs font-bold px-3 py-1">
              PENDING SUPER ADMIN APPROVAL
            </Badge>
            <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Workspace Request Submitted
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              Your request to provision <strong className="text-foreground">{request.organizationName}</strong> has been sent to the platform Super Admins.
            </p>
          </div>

          {/* Details Card */}
          <div className="rounded-2xl bg-muted/40 p-4 text-left space-y-2 text-xs border border-border/50">
            <div className="flex justify-between items-center border-b border-border/40 pb-2">
              <span className="text-muted-foreground font-semibold">Company Name</span>
              <span className="font-bold text-foreground">{request.organizationName}</span>
            </div>
            <div className="flex justify-between items-center border-b border-border/40 pb-2">
              <span className="text-muted-foreground font-semibold">Subdomain</span>
              <span className="font-mono font-bold text-primary">{request.organizationSlug}.marketops.app</span>
            </div>
            <div className="flex justify-between items-center border-b border-border/40 pb-2">
              <span className="text-muted-foreground font-semibold">Applicant Admin</span>
              <span className="font-bold text-foreground">{request.applicantEmail}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-muted-foreground font-semibold">Submitted On</span>
              <span className="text-muted-foreground">
                {new Date(request.createdAt).toLocaleDateString()} at {new Date(request.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Email Notification Alert */}
          <div className="rounded-xl bg-primary/5 p-3.5 text-xs text-left flex items-start gap-3 border border-primary/20">
            <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-foreground">Email Notifications Dispatched</p>
              <p className="text-muted-foreground">
                All platform Super Admins have been notified via email. As soon as any Super Admin approves your request, your full workspace dashboard will unlock automatically.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl text-xs font-bold w-full sm:w-auto"
              onClick={fetchStatus}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh Status
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // SCENARIO 2: REJECTED REQUEST SCREEN (ALLOW RE-SUBMIT)
  // ------------------------------------------------------------------
  if (request && request.status === "rejected") {
    return (
      <div className="mx-auto max-w-xl py-12 px-4 space-y-6">
        <div className="rounded-3xl border bg-card p-6 sm:p-8 shadow-lg text-center space-y-6">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-500/10 text-rose-500 ring-8 ring-rose-500/5">
            <AlertCircle className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-xs font-bold px-3 py-1">
              REQUEST DECLINED
            </Badge>
            <h2 className="text-2xl font-black tracking-tight text-foreground">
              Workspace Request Declined
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              Your previous request for <strong className="text-foreground">{request.organizationName}</strong> was not approved by a Super Admin.
            </p>
          </div>

          {request.rejectionReason && (
            <div className="rounded-2xl bg-rose-500/10 p-4 text-left border border-rose-500/20 text-xs">
              <span className="font-bold text-rose-600 dark:text-rose-400 block mb-1">Reason provided by Super Admin:</span>
              <p className="text-foreground font-medium">{request.rejectionReason}</p>
            </div>
          )}

          <Button
            className="gap-2 rounded-xl text-xs font-bold w-full"
            onClick={() => setRequest(null)}
          >
            Submit New Workspace Request
          </Button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // SCENARIO 3: WORKSPACE CREATION FORM FOR NEW ADMIN
  // ------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-xl py-12 px-4 space-y-6">
      <div className="rounded-3xl border bg-card p-6 sm:p-8 shadow-lg space-y-6">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary font-bold shadow-xs">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary">
              ADMIN SETUP
            </Badge>
            <h2 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
              Create Client Workspace Instance
            </h2>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Welcome <strong className="text-foreground">{currentUser?.name || currentUser?.email}</strong>! As an Organization Admin, fill in your company details below to request your dedicated, isolated MarketOps workspace.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="companyName" className="text-xs font-bold">
              Company / Organization Name *
            </Label>
            <Input
              id="companyName"
              placeholder="e.g. Hawaii Technicals"
              value={companyName}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              className="h-10 text-xs rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug" className="text-xs font-bold">
              Workspace Subdomain Slug *
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="slug"
                placeholder="hawaii-technicals"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setIsCustomSlug(true);
                }}
                required
                className="h-10 text-xs font-mono rounded-xl flex-1"
              />
              <span className="text-xs font-mono font-bold text-muted-foreground whitespace-nowrap">
                .marketops.app
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              This will be your workspace's unique subdomain link.
            </p>
          </div>

          <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1.5 border border-border/40">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Super Admin Approval Process</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-normal">
              Once submitted, all Super Admins will be notified via email to review and approve your workspace request.
            </p>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-xl text-xs font-bold gap-2 shadow-md hover:shadow-lg transition-all"
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Submitting Request...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Submit Request to Super Admin</span>
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
