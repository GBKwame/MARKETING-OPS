import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Copy,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  File,
  Plus,
  Link2,
  UploadCloud,
  AlertTriangle,
  Play,
  CheckCircle2,
  Eye,
  Trash2,
  Sparkles,
  Filter,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import type { Asset } from "@/lib/store";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/assets")({
  head: () => ({
    meta: [
      { title: "Assets — Zexpand" },
      { name: "description", content: "Approved, company-owned marketing materials." },
      { property: "og:title", content: "Marketing Assets" },
      { property: "og:description", content: "One-click copy for text, downloads for media." },
    ],
  }),
  component: AssetsPage,
});

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const CATEGORY_OPTIONS = ["General"];

const ASSET_TYPES: { key: Asset["type"]; label: string; icon: any }[] = [
  { key: "image", label: "Image", icon: ImageIcon },
  { key: "video", label: "Video", icon: Film },
  { key: "flyer", label: "Flyer / Document", icon: FileText },
  { key: "text", label: "Copywriting / Text", icon: FileText },
  { key: "other", label: "Other", icon: File },
];

const iconFor = (t: Asset["type"]) => {
  if (t === "flyer") return FileText;
  if (t === "video") return Film;
  if (t === "image") return ImageIcon;
  if (t === "text") return FileText;
  return File;
};

// YouTube Video ID extractor (Supports standard, shorts, embed & share links)
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

function getYouTubeEmbedUrl(url: string): string | null {
  const id = getYouTubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null;
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
      return "Selected asset type is Copywriting / Text. Please upload a text or document file (.txt, .docx, .pdf).";
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

function AssetsPage() {
  const { currentUser, assets, createAsset, deleteAsset } = useStore();
  const [tab, setTab] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Watch / Preview Modal State
  const [playingAsset, setPlayingAsset] = useState<Asset | null>(null);

  // Delete Confirmation State
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<Asset["type"]>("image");
  const [categorySelect, setCategorySelect] = useState<string>("General");
  const [customCategory, setCustomCategory] = useState<string>("");
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");
  const [url, setUrl] = useState("");
  const [bodyText, setBodyText] = useState("");

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Custom Category State
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("marketops_custom_categories");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [openCategoryModal, setOpenCategoryModal] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");

  const allCategories = Array.from(
    new Set([
      ...CATEGORY_OPTIONS,
      ...customCategories,
      ...assets.map((a) => a.category).filter((c): c is string => Boolean(c)),
    ])
  );

  const canUpload = currentUser?.role === "admin" || currentUser?.role === "manager";

  // Filter assets by Type and Category
  const filtered = assets.filter((a) => {
    const matchesTab = tab === "all" || a.type === tab;
    const matchesCat = selectedCategory === "all" || (a.category || "General") === selectedCategory;
    return matchesTab && matchesCat;
  });

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatInput.trim();
    if (!trimmed) return;

    if (allCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`Category "${trimmed}" already exists.`);
      return;
    }

    const updated = [...customCategories, trimmed];
    setCustomCategories(updated);
    try {
      localStorage.setItem("marketops_custom_categories", JSON.stringify(updated));
    } catch {}

    toast.success(`Category "${trimmed}" created successfully!`);
    setNewCatInput("");
    setOpenCategoryModal(false);
    setCategorySelect(trimmed);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);
    if (!file) {
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setFileError(
        `File size (${sizeMB} MB) exceeds the 10 MB limit. Please upload large videos/files to YouTube, Vimeo, or Google Drive and use the "By URL" option.`
      );
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    const typeError = validateFileType(file, type);
    if (typeError) {
      setFileError(typeError);
      toast.error(typeError);
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    setSelectedFile(file);

    // Generate Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please provide an asset title.");
      return;
    }

    if (uploadMode === "file" && fileError) {
      toast.error(fileError);
      return;
    }

    const finalCategory =
      categorySelect === "Other"
        ? customCategory.trim() || "Other"
        : categorySelect;

    if (finalCategory && !allCategories.includes(finalCategory)) {
      const updated = [...customCategories, finalCategory];
      setCustomCategories(updated);
      try {
        localStorage.setItem("marketops_custom_categories", JSON.stringify(updated));
      } catch {}
    }

    setSubmitting(true);
    try {
      let finalPreviewUrl = "";
      let finalFileUrl = "";

      if (uploadMode === "url") {
        finalFileUrl = url.trim();
        // Check if YouTube URL
        const ytThumb = getYouTubeThumbnail(finalFileUrl);
        if (ytThumb) {
          finalPreviewUrl = ytThumb;
        } else {
          finalPreviewUrl = finalFileUrl;
        }
      } else if (uploadMode === "file") {
        finalPreviewUrl = filePreview || "";
        finalFileUrl = filePreview || "";
      }

      await createAsset({
        title: title.trim(),
        description: description.trim(),
        type,
        category: finalCategory,
        previewUrl: finalPreviewUrl,
        fileUrl: finalFileUrl,
        version: "v1.0",
        body: type === "text" ? bodyText.trim() : undefined,
      });

      toast.success(`Asset "${title}" created successfully!`);
      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload asset");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!assetToDelete) return;
    setDeleting(true);
    try {
      await deleteAsset(assetToDelete.id);
      toast.success(`Asset "${assetToDelete.title}" deleted.`);
      setAssetToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete asset");
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setType("image");
    setCategorySelect("General");
    setCustomCategory("");
    setUploadMode("url");
    setUrl("");
    setBodyText("");
    setSelectedFile(null);
    setFilePreview(null);
    setFileError(null);
  };

  const handleDownloadMedia = async (fileUrl: string, title: string) => {
    if (!fileUrl) return;
    toast.info("Downloading file...");
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error("Fetch failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const isVideo = fileUrl.includes("mp4") || fileUrl.includes("video") || fileUrl.includes("webm");
      const ext = isVideo ? "mp4" : "jpg";
      a.download = `${cleanTitle}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success("Download started!");
    } catch (err) {
      const a = document.createElement("a");
      a.href = fileUrl;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.download = title;
      a.click();
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Assets"
        description="Approved, company-owned marketing materials."
        actions={
          canUpload ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 cursor-pointer font-semibold shadow-xs"
                onClick={() => setOpenCategoryModal(true)}
              >
                <Plus className="h-4 w-4" /> Add Category
              </Button>
              <Button
                size="sm"
                className="gap-1.5 cursor-pointer font-semibold shadow-xs"
                onClick={() => {
                  resetForm();
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Upload asset
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Tabs & Category Filter */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <Tabs value={tab} onValueChange={setTab} className="flex-1 min-w-[280px]">
          <TabsList>
            <TabsTrigger value="all">All Types</TabsTrigger>
            <TabsTrigger value="flyer">Flyers</TabsTrigger>
            <TabsTrigger value="video">Videos</TabsTrigger>
            <TabsTrigger value="image">Images</TabsTrigger>
            <TabsTrigger value="text">Texts</TabsTrigger>
            <TabsTrigger value="other">Other</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Category Dropdown Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-semibold shadow-xs focus:border-primary focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Categories</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a) => {
          const Icon = iconFor(a.type);
          const mediaUrl = a.fileUrl || a.previewUrl || "";
          const ytThumb = getYouTubeThumbnail(mediaUrl) || getYouTubeThumbnail(a.previewUrl || "");
          const isYouTube = Boolean(ytThumb || mediaUrl.includes("youtube.com") || mediaUrl.includes("youtu.be"));
          const isVideoFile = a.type === "video" && !isYouTube;
          const previewImg =
            ytThumb ||
            a.preview ||
            a.previewUrl ||
            "https://images.unsplash.com/photo-1611926653458-09294b3142bf?w=600";

          return (
            <div
              key={a.id}
              className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md flex flex-col justify-between"
            >
              <div>
                <div
                  className="relative aspect-[16/10] bg-muted overflow-hidden cursor-pointer"
                  onClick={() => setPlayingAsset(a)}
                >
                  {isVideoFile ? (
                    <video
                      src={mediaUrl}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={previewImg}
                      alt={a.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                  {a.type === "video" && (
                    <div className="absolute inset-0 grid place-items-center bg-black/30 backdrop-blur-[2px]">
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-110">
                        <Play className="h-5 w-5 fill-current ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Category Badge Tag */}
                  <Badge
                    variant="secondary"
                    className="absolute top-2.5 right-2.5 h-5 text-[10px] font-semibold backdrop-blur-md bg-background/80"
                  >
                    {a.category || "General"}
                  </Badge>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate text-sm font-semibold">{a.title}</span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {a.description}
                      </div>
                    </div>

                    {/* Delete Icon Button */}
                    {canUpload && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssetToDelete(a);
                        }}
                        className="h-7 w-7 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                        title="Delete Asset"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons Section */}
              <div className="p-4 pt-0">
                <div className="border-t pt-3">
                  {a.type === "text" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-1.5 cursor-pointer text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(a.body || a.description || "");
                        toast.success("Copied text to clipboard!");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Text
                    </Button>
                  ) : a.type === "video" ? (
                    <div className="flex items-center gap-2">
                      {/* Watch Video Button */}
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 cursor-pointer text-xs font-semibold"
                        onClick={() => setPlayingAsset(a)}
                      >
                        <Play className="h-3.5 w-3.5 fill-current" /> Watch
                      </Button>

                      {/* Download Video Button (Disabled if YouTube) */}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isYouTube}
                        className={`flex-1 gap-1.5 text-xs ${
                          isYouTube
                            ? "opacity-50 cursor-not-allowed text-muted-foreground"
                            : "cursor-pointer"
                        }`}
                        title={
                          isYouTube
                            ? "YouTube videos cannot be downloaded directly"
                            : "Download Video"
                        }
                        onClick={() => {
                          if (isYouTube) {
                            toast.error("YouTube videos cannot be downloaded directly.");
                          } else {
                            handleDownloadMedia(mediaUrl, a.title);
                          }
                        }}
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {/* Preview Button for Images / Flyers */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5 cursor-pointer text-xs"
                        onClick={() => setPlayingAsset(a)}
                      >
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </Button>

                      {/* Download Button */}
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 cursor-pointer text-xs font-semibold"
                        onClick={() => handleDownloadMedia(mediaUrl, a.title)}
                      >
                        <Download className="h-3.5 w-3.5" /> Download
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
      <Dialog open={!!assetToDelete} onOpenChange={(val) => !val && setAssetToDelete(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Confirm Asset Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground">
            Are you sure you want to delete <span className="font-bold text-foreground">"{assetToDelete?.title}"</span>? This action cannot be undone.
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setAssetToDelete(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              className="rounded-xl font-bold px-4"
              onClick={handleConfirmDelete}
            >
              {deleting ? "Deleting..." : "Delete Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Watch / Video / Asset Modal */}
      <Dialog open={!!playingAsset} onOpenChange={(val) => !val && setPlayingAsset(null)}>
        <DialogContent className="sm:max-w-[720px] p-0 rounded-2xl border bg-card overflow-hidden shadow-2xl">
          {playingAsset && (
            <div>
              <div className="relative border-b bg-muted/40 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-primary" />
                  <span className="font-bold text-sm">{playingAsset.title}</span>
                </div>
                <Badge variant="outline">{playingAsset.category || "General"}</Badge>
              </div>

              <div className="p-4 bg-black flex justify-center items-center min-h-[340px]">
                {playingAsset.type === "video" ? (
                  getYouTubeEmbedUrl(playingAsset.fileUrl || playingAsset.previewUrl || "") ? (
                    <iframe
                      src={getYouTubeEmbedUrl(playingAsset.fileUrl || playingAsset.previewUrl || "")!}
                      title={playingAsset.title}
                      className="w-full aspect-video rounded-xl shadow-lg"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={playingAsset.fileUrl || playingAsset.previewUrl}
                      controls
                      autoPlay
                      className="max-h-[70vh] w-full rounded-xl object-contain shadow-lg"
                    />
                  )
                ) : (
                  <img
                    src={playingAsset.fileUrl || playingAsset.previewUrl}
                    alt={playingAsset.title}
                    className="max-h-[70vh] w-full object-contain rounded-xl shadow-lg"
                  />
                )}
              </div>

              <div className="p-4 border-t text-xs space-y-1">
                <div className="font-semibold text-foreground">{playingAsset.title}</div>
                <div className="text-muted-foreground">{playingAsset.description}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Asset Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <form onSubmit={handleUpload}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Upload New Marketing Asset</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4 text-xs">
              {/* 1. Asset Type Selector */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  1. Select Asset Type
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {ASSET_TYPES.map((item) => {
                    const IconComp = item.icon;
                    const isSelected = type === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setType(item.key)}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                            : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                      >
                        <IconComp className="h-4 w-4 shrink-0" />
                        <span className="text-[10px] truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Asset Title & Category */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Asset Title *
                  </label>
                  <Input
                    required
                    placeholder="e.g. Q3 Caregiver Banner"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Category *
                  </label>
                  <select
                    value={categorySelect}
                    onChange={(e) => setCategorySelect(e.target.value)}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer font-medium"
                  >
                    {allCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="Other">+ Create New Category...</option>
                  </select>
                  {categorySelect === "Other" && (
                    <Input
                      placeholder="Enter custom category name..."
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="mt-1.5 h-9 text-xs"
                      autoFocus
                    />
                  )}
                </div>
              </div>

              {/* 3. Description */}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Description / Campaign Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Short summary of this asset..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* 4. Text Body (Only for copywriting/text type) */}
              {type === "text" && (
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Copywriting Content / Post Copy
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Paste full text, caption, or ad copy here..."
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              )}

              {/* 5. Upload Mode Switcher (URL vs File) */}
              {type !== "text" && (
                <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Upload Method ({type.toUpperCase()})
                    </span>
                    <div className="flex rounded-lg border bg-background p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setUploadMode("url")}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                          uploadMode === "url"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        By URL
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadMode("file")}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                          uploadMode === "file"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Direct Upload
                      </button>
                    </div>
                  </div>

                  {/* URL Input Mode */}
                  {uploadMode === "url" && (
                    <div className="space-y-1">
                      <Input
                        placeholder="https://... (Direct file URL or YouTube link)"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="bg-background text-xs"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {type === "video"
                          ? "💡 Tip: YouTube & Vimeo URLs will automatically generate video thumbnail previews!"
                          : "Direct link to image, document, or web material."}
                      </p>
                    </div>
                  )}

                  {/* Direct File Upload Mode */}
                  {uploadMode === "file" && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Select Local File (Max 10 MB)
                      </label>
                      <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 p-5 text-center transition-colors hover:border-primary/50 bg-muted/10">
                        <input
                          type="file"
                          accept={getAcceptAttribute(type)}
                          required={uploadMode === "file" && !selectedFile}
                          onChange={handleFileChange}
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                        <UploadCloud className="h-8 w-8 text-muted-foreground/80 mb-2" />
                        {selectedFile ? (
                          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>{selectedFile.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="text-xs font-semibold text-foreground">
                              Click to browse or drop file here
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              Allowed: {getAcceptAttribute(type)} (Max file size: 10 MB)
                            </div>
                          </>
                        )}
                      </div>

                      {fileError && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <div>{fileError}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live Preview Box */}
                  {(filePreview || (uploadMode === "url" && url)) && (
                    <div className="flex items-center gap-3 rounded-lg border bg-background p-2 mt-2">
                      {type === "video" || (filePreview && filePreview.startsWith("data:video/")) ? (
                        <video
                          src={filePreview || url}
                          className="h-12 w-16 rounded-md object-cover border shrink-0 bg-black"
                          muted
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={filePreview || url}
                          alt="Asset Preview"
                          className="h-12 w-16 rounded-md object-cover border shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-emerald-500 text-xs flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> File Attached & Ready
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[280px]">
                          {selectedFile ? selectedFile.name : url}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Uploading..." : "Save Asset"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Category Modal (Admins & Managers) */}
      <Dialog open={openCategoryModal} onOpenChange={setOpenCategoryModal}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-6">
          <form onSubmit={handleAddCategory}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Create New Asset Category
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-2 text-xs">
              <label className="font-semibold text-muted-foreground">Category Name *</label>
              <Input
                required
                placeholder="e.g. Q3 Campaigns, Webinars, Brochures..."
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                className="h-9 text-xs"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                This category will be available in the dropdown for all Admins and Managers when uploading marketing assets.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setOpenCategoryModal(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button size="sm" type="submit" className="rounded-xl font-bold px-4">
                Save Category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}