import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Check, X, Plus, Upload, Link2, Image as ImageIcon, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import type { Approval } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createApprovalApi } from "@/lib/api";

export const Route = createFileRoute("/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals — MarketOps" },
      { name: "description", content: "Review and approve submitted designs, videos, and copy." },
      { property: "og:title", content: "Approvals" },
      { property: "og:description", content: "Approved items move directly into Assets." },
    ],
  }),
  component: ApprovalsPage,
});

const tones: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
  approved: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
  rejected: "bg-destructive/15 text-destructive",
};

function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }
  return null;
}

function getYouTubeThumbnail(url: string): string | null {
  const id = getYouTubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

function validateFileType(file: File, assetType: string): string | null {
  if (assetType === "image") {
    if (!file.type.startsWith("image/")) {
      return "Selected asset type is Image. Please upload an image file (PNG, JPG, WebP, GIF, SVG).";
    }
  } else if (assetType === "video") {
    if (!file.type.startsWith("video/")) {
      return "Selected asset type is Video. Please upload a video file (MP4, WebM, MOV, AVI).";
    }
  } else if (assetType === "flyer") {
    const isDoc =
      file.type.startsWith("image/") ||
      file.type.includes("pdf") ||
      file.name.endsWith(".pdf") ||
      file.name.endsWith(".doc") ||
      file.name.endsWith(".docx") ||
      file.name.endsWith(".ppt") ||
      file.name.endsWith(".pptx");
    if (!isDoc) {
      return "Selected asset type is Flyer / Document. Please upload an image or document (PDF, PNG, JPG, DOCX).";
    }
  } else if (assetType === "text") {
    const isText =
      file.type.startsWith("text/") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".doc") ||
      file.name.endsWith(".docx") ||
      file.name.endsWith(".pdf");
    if (!isText) {
      return "Selected asset type is Copy / Text. Please upload a text or document file (.txt, .docx, .pdf).";
    }
  }
  return null;
}

function getAcceptAttribute(assetType: string): string {
  if (assetType === "image") return "image/*";
  if (assetType === "video") return "video/*";
  if (assetType === "flyer") return "image/*,.pdf,.doc,.docx,.ppt,.pptx";
  if (assetType === "text") return "text/*,.txt,.doc,.docx,.pdf";
  return "*/*";
}

function ApprovalsPage() {
  const { currentUser, approvals, memberById, setApprovalStatus, deleteApproval, refreshData } = useStore();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation State
  const [approvalToDelete, setApprovalToDelete] = useState<Approval | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"flyer" | "video" | "image" | "text" | "other">("image");
  
  // Direct Upload vs URL State
  const [previewMode, setPreviewMode] = useState<"upload" | "url">("upload");
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");

  const canReview = currentUser?.role === "admin" || currentUser?.role === "manager";

  const handleConfirmDelete = async () => {
    if (!approvalToDelete) return;
    setDeleting(true);
    try {
      await deleteApproval(approvalToDelete.id);
      toast.success(`Approval submission "${approvalToDelete.title}" deleted.`);
      setApprovalToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete submission");
    } finally {
      setDeleting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10 MB limit.");
      e.target.value = "";
      return;
    }

    const typeError = validateFileType(file, type);
    if (typeError) {
      toast.error(typeError);
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

  const handleTypeChange = (newType: "flyer" | "video" | "image" | "text" | "other") => {
    setType(newType);
    if (selectedFile) {
      const typeError = validateFileType(selectedFile, newType);
      if (typeError) {
        toast.error(`Switched to ${newType.toUpperCase()}: ${typeError}`);
        setSelectedFile(null);
        setFilePreview(null);
      }
    }
  };

  const resetForm = () => {
    setTitle("");
    setType("image");
    setPreviewMode("upload");
    setPreviewUrl("");
    setSelectedFile(null);
    setFilePreview(null);
    setDescription("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalPreview = previewMode === "url" ? previewUrl.trim() : filePreview;

    setSubmitting(true);
    try {
      await createApprovalApi({
        title: title.trim(),
        type,
        previewUrl: finalPreview || undefined,
        description: description.trim() || "",
      });
      toast.success("Submission received! Reviewers notified.");
      setOpen(false);
      resetForm();
      await refreshData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit for approval");
    } finally {
      setSubmitting(false);
    }
  };

  const activePreview = previewMode === "url" ? previewUrl : filePreview;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Approvals"
        description="Approved items automatically move into Assets."
        actions={
          <Button
            size="sm"
            className="gap-1.5 cursor-pointer font-semibold"
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Submit for approval
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {approvals.map((a) => {
          const m = memberById(a.submittedById);
          const mediaUrl = a.previewUrl || a.preview || "";
          const ytThumb = getYouTubeThumbnail(mediaUrl);
          const isVideoFile = a.type === "video" && !ytThumb && !mediaUrl.includes("youtube.com") && !mediaUrl.includes("youtu.be");
          const previewImg = ytThumb || a.preview || a.previewUrl || "https://images.unsplash.com/photo-1611926653458-09294b3142bf?w=600";
          return (
            <div key={a.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm flex flex-col justify-between">
              <div>
                <div className="aspect-[16/10] bg-muted overflow-hidden">
                  {isVideoFile ? (
                    <video src={mediaUrl} className="h-full w-full object-cover" muted preload="metadata" />
                  ) : (
                    <img src={previewImg} alt={a.title} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{a.title}</span>
                        <Badge className={cn("h-5 capitalize shrink-0", tones[a.status])} variant="secondary">
                          {a.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground capitalize mt-0.5">
                        {a.type} · {m?.name || "Team Member"}
                      </div>
                    </div>

                    {/* Delete Icon Button */}
                    {canReview && (
                      <button
                        type="button"
                        onClick={() => setApprovalToDelete(a)}
                        className="h-7 w-7 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                        title="Delete Approval Item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
                </div>
              </div>
              <div className="p-4 pt-0">
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-[11px] text-muted-foreground">
                    Submitted {format(new Date(a.submittedAt), "d MMM")}
                  </span>
                  {a.status === "pending" && canReview && (
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={async () => {
                          try {
                            await setApprovalStatus(a.id, "rejected");
                            toast.error("Submission Rejected");
                          } catch (err) {
                            toast.error("Failed to reject submission");
                          }
                        }}
                      >
                        <X className="h-3 w-3" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 gap-1 text-xs cursor-pointer font-semibold"
                        onClick={async () => {
                          try {
                            await setApprovalStatus(a.id, "approved");
                            toast.success("Approved — added to Assets");
                          } catch (err) {
                            toast.error("Failed to approve submission");
                          }
                        }}
                      >
                        <Check className="h-3 w-3" /> Approve
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!approvalToDelete} onOpenChange={(val) => !val && setApprovalToDelete(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Confirm Submission Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground">
            Are you sure you want to delete approval submission <span className="font-bold text-foreground">"{approvalToDelete?.title}"</span>? This action cannot be undone.
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setApprovalToDelete(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              className="rounded-xl font-bold px-4"
              onClick={handleConfirmDelete}
            >
              {deleting ? "Deleting..." : "Delete Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 rounded-2xl border bg-card shadow-2xl overflow-hidden">
          <form onSubmit={handleSubmit}>
            <div className="border-b bg-muted/40 px-6 py-4">
              <DialogTitle className="text-base font-bold">Submit for Approval</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Submit creative assets or copy for team manager sign-off.
              </p>
            </div>

            <div className="space-y-4 p-6 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground uppercase">TITLE</label>
                <Input
                  required
                  placeholder="e.g. Q3 Recruitment Flyer v2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 h-9 text-xs rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground uppercase">ASSET TYPE</label>
                <select
                  className="mt-1 flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs shadow-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value as any)}
                >
                  <option value="image">Image / Graphic</option>
                  <option value="video">Video</option>
                  <option value="flyer">Flyer / Document</option>
                  <option value="text">Copy / Text</option>
                  <option value="other">Other Asset</option>
                </select>
              </div>

              {/* Direct Upload vs URL Toggle */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-primary" /> Asset File / Preview ({type.toUpperCase()})
                  </label>
                  <div className="flex rounded-lg border bg-background p-0.5">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("upload")}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                        previewMode === "upload" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Upload className="h-3 w-3" /> Direct Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("url")}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                        previewMode === "url" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Link2 className="h-3 w-3" /> By URL
                    </button>
                  </div>
                </div>

                {previewMode === "upload" ? (
                  <div>
                    <label className="flex min-h-[90px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-input bg-background p-3 text-center transition-colors hover:border-primary">
                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="font-semibold text-foreground text-xs">
                        {selectedFile ? selectedFile.name : `Click to select ${type.toUpperCase()} file`}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        Allowed: {getAcceptAttribute(type)} (up to 10 MB)
                      </span>
                      <input type="file" accept={getAcceptAttribute(type)} onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>
                ) : (
                  <div>
                    <Input
                      placeholder="https://... (image or asset link)"
                      value={previewUrl}
                      onChange={(e) => setPreviewUrl(e.target.value)}
                      className="h-9 text-xs rounded-lg bg-background"
                    />
                  </div>
                )}

                {/* Preview Thumbnail */}
                {activePreview && (
                  <div className="flex items-center gap-3 rounded-lg border bg-background p-2">
                    {type === "video" || activePreview.startsWith("data:video/") || activePreview.includes("mp4") || activePreview.includes("webm") ? (
                      <video
                        src={activePreview}
                        className="h-12 w-16 rounded-md object-cover border shrink-0 bg-black"
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={activePreview}
                        alt="Asset Preview"
                        className="h-12 w-16 rounded-md object-cover border shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-emerald-500 text-xs flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> File Attached & Ready
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[280px]">
                        {selectedFile ? selectedFile.name : activePreview}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="font-semibold text-muted-foreground uppercase">NOTES / DESCRIPTION</label>
                <textarea
                  rows={3}
                  className="mt-1 flex w-full rounded-lg border border-input bg-background px-3 py-2 text-xs shadow-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="Context for reviewer..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="border-t bg-muted/20 px-6 py-3.5 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="rounded-lg">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="rounded-lg font-semibold px-5 shadow-sm">
                {submitting ? "Submitting..." : "Submit for Approval"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}