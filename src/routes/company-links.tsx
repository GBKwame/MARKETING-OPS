import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Globe,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Twitter,
  MessageCircle,
  Music2,
  Mail,
  Copy,
  Check,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  Link2,
  Shield,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useStore, type CompanyLink } from "@/lib/store";

export const Route = createFileRoute("/company-links")({
  head: () => ({
    meta: [
      { title: "Company Links — Zexpand" },
      { name: "description", content: "Official company accounts and handles for your workspace." },
      { property: "og:title", content: "Company Links — Zexpand" },
      { property: "og:description", content: "Quickly open the correct company accounts across every channel." },
    ],
  }),
  component: CompanyLinksPage,
});

type Platform =
  | "Website"
  | "Facebook"
  | "Instagram"
  | "TikTok"
  | "LinkedIn"
  | "YouTube"
  | "X"
  | "WhatsApp Business"
  | "Email";

const PLATFORM_META: Record<string, { icon: React.ComponentType<{ className?: string }>; tint: string }> = {
  Website: { icon: Globe, tint: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
  Facebook: { icon: Facebook, tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  Instagram: { icon: Instagram, tint: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
  TikTok: { icon: Music2, tint: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400" },
  LinkedIn: { icon: Linkedin, tint: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  YouTube: { icon: Youtube, tint: "bg-red-500/10 text-red-600 dark:text-red-400" },
  X: { icon: Twitter, tint: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300" },
  "WhatsApp Business": { icon: MessageCircle, tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  Email: { icon: Mail, tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

const PLATFORM_ORDER: string[] = [
  "Website",
  "Facebook",
  "Instagram",
  "TikTok",
  "LinkedIn",
  "YouTube",
  "X",
  "WhatsApp Business",
  "Email",
];

function CompanyLinksPage() {
  const { currentUser, companyLinks, updateCompanyLink, deleteCompanyLink } = useStore();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "super_admin";

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<Partial<CompanyLink> | null>(null);
  const [linkToDelete, setLinkToDelete] = useState<CompanyLink | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Group company links by platform
  const linksByPlatform = useMemo(() => {
    const map = new Map<string, CompanyLink[]>();
    PLATFORM_ORDER.forEach((p) => map.set(p, []));

    companyLinks.forEach((l) => {
      if (!l.platform) return;
      const existing = map.get(l.platform) || [];
      existing.push(l);
      map.set(l.platform, existing);
    });

    return map;
  }, [companyLinks]);

  const totalConnectedLinks = useMemo(() => {
    return companyLinks.filter((l) => Boolean(l.url || l.handle)).length;
  }, [companyLinks]);

  const connectedPlatformsCount = useMemo(() => {
    let count = 0;
    linksByPlatform.forEach((items) => {
      if (items.some((i) => i.url || i.handle)) count++;
    });
    return count;
  }, [linksByPlatform]);

  const handleCopy = async (link: CompanyLink) => {
    const copyText = link.url || link.handle || "";
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopiedId(link.id);
      toast.success(`Copied "${link.label || link.platform}" link`);
      setTimeout(() => setCopiedId((id) => (id === link.id ? null : id)), 1500);
    } catch {
      toast.error("Couldn't copy link — try again.");
    }
  };

  const handleSaveLink = async (data: { id?: string; platform: string; label?: string; url: string | null; handle?: string }) => {
    try {
      await updateCompanyLink(data);
      setEditingLink(null);
      toast.success(`Saved link for ${data.platform}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save company link");
      throw err;
    }
  };

  const handleConfirmDeleteLink = async () => {
    if (!linkToDelete) return;
    setDeleting(true);
    try {
      await deleteCompanyLink(linkToDelete.id);
      toast.success(`Deleted link "${linkToDelete.label || linkToDelete.platform}".`);
      setLinkToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete link");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Company Links"
        description={`${totalConnectedLinks} active link(s) across ${connectedPlatformsCount} connected platforms`}
        actions={
          isAdmin ? (
            <Button
              size="sm"
              className="gap-1.5 font-bold shadow-xs cursor-pointer"
              onClick={() => setEditingLink({ platform: "Facebook", label: "Main Account", url: "" })}
            >
              <Plus className="h-4 w-4" /> Add Company Link
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-xl border">
              <Shield className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>Only Admins can add or edit company links</span>
            </div>
          )
        }
      />

      {/* Desktop / Tablet Table View */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 border-b">
            <tr>
              <th className="px-5 py-3.5 text-left w-[220px]">Platform</th>
              <th className="px-5 py-3.5 text-left">Links / Handles (Supports Multiple Accounts)</th>
              {isAdmin && <th className="px-5 py-3.5 text-right w-[140px]">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {PLATFORM_ORDER.map((platformName) => {
              const meta = PLATFORM_META[platformName] || { icon: Globe, tint: "bg-slate-500/10 text-slate-600" };
              const Icon = meta.icon;
              const items = linksByPlatform.get(platformName) || [];
              const hasLinks = items.length > 0;

              return (
                <tr key={platformName} className="transition-colors hover:bg-muted/20 align-top">
                  {/* Platform Column */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${meta.tint}`}>
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white">{platformName}</div>
                        <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                          {hasLinks ? `${items.length} ${items.length === 1 ? "account" : "accounts"}` : "No accounts"}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Multi-Account Links / Handles Column */}
                  <td className="px-5 py-4">
                    {!hasLinks ? (
                      <span className="text-xs text-muted-foreground italic">No accounts connected yet.</span>
                    ) : (
                      <div className="space-y-2">
                        {items.map((item) => {
                          const isCopied = copiedId === item.id;
                          return (
                            <div
                              key={item.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/10 p-2.5 hover:bg-muted/30 transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                                  <span>{item.label || item.platform}</span>
                                  {item.handle && (
                                    <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                      {item.handle}
                                    </Badge>
                                  )}
                                </div>
                                {item.url && (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline truncate max-w-[420px]"
                                  >
                                    <span className="truncate">{item.url}</span>
                                    <ExternalLink className="h-3 w-3 shrink-0 opacity-75" />
                                  </a>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {/* Copy Button */}
                                {(item.url || item.handle) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs gap-1.5 rounded-lg cursor-pointer"
                                    onClick={() => handleCopy(item)}
                                    title="Copy Link URL / Handle"
                                  >
                                    {isCopied ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                    <span>{isCopied ? "Copied" : "Copy"}</span>
                                  </Button>
                                )}

                                {/* Admin Only: Edit Link Entry */}
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                                    onClick={() => setEditingLink(item)}
                                    title="Edit Account Link"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}

                                {/* Admin Only: Delete Link Entry */}
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                                    onClick={() => setLinkToDelete(item)}
                                    title="Delete Account Link"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>

                  {/* Actions Column (Admin Only) */}
                  {isAdmin && (
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-semibold gap-1.5 rounded-lg cursor-pointer"
                        onClick={() =>
                          setEditingLink({
                            platform: platformName,
                            label: items.length > 0 ? `${platformName} Account #${items.length + 1}` : `${platformName} Main`,
                            url: "",
                          })
                        }
                      >
                        <Plus className="h-3.5 w-3.5 text-primary" /> Add Account
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Link Entry Dialog (Admin Only) */}
      <AddEditLinkDialog
        link={editingLink}
        onClose={() => setEditingLink(null)}
        onSave={handleSaveLink}
      />

      {/* Delete Link Confirmation Dialog */}
      <Dialog open={!!linkToDelete} onOpenChange={(val) => !val && setLinkToDelete(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Delete Account Link
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground">
            Are you sure you want to delete <span className="font-bold text-foreground">"{linkToDelete?.label || linkToDelete?.platform}"</span>? This action cannot be undone.
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setLinkToDelete(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              className="rounded-xl font-bold px-4"
              onClick={handleConfirmDeleteLink}
            >
              {deleting ? "Deleting..." : "Delete Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddEditLinkDialog({
  link,
  onClose,
  onSave,
}: {
  link: Partial<CompanyLink> | null;
  onClose: () => void;
  onSave: (data: { id?: string; platform: string; label?: string; url: string | null; handle?: string }) => Promise<void>;
}) {
  const [platform, setPlatform] = useState("Facebook");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [handle, setHandle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (link) {
      setPlatform(link.platform || "Facebook");
      setLabel(link.label || "");
      setUrl(link.url || "");
      setHandle(link.handle || "");
    }
  }, [link]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link) return;

    if (!url.trim() && !handle.trim()) {
      toast.error("Please provide either a Link URL or Handle.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: link.id,
        platform,
        label: label.trim() || platform,
        url: url.trim() || null,
        handle: handle.trim() || undefined,
      });
    } catch {
      // Handled in parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!link} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px] rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            {link?.id ? `Edit ${link.platform} Account` : `Add Company Link / Account`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs pt-2">
          {/* Select Platform */}
          <div className="space-y-1.5">
            <Label className="font-semibold text-muted-foreground">Platform *</Label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer font-bold"
            >
              {PLATFORM_ORDER.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Account Label */}
          <div className="space-y-1.5">
            <Label className="font-semibold text-muted-foreground">
              Account Label / Title *
            </Label>
            <Input
              placeholder="e.g. Main Page, Recruitment Group, Accra Support"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-9 text-xs"
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Descriptive name to distinguish multiple accounts for the same platform.
            </p>
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <Label className="font-semibold text-muted-foreground">Website / Page Link URL</Label>
            <Input
              placeholder="https://facebook.com/your_page_or_group"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* Handle */}
          <div className="space-y-1.5">
            <Label className="font-semibold text-muted-foreground">Display Handle / Username (Optional)</Label>
            <Input
              placeholder="e.g. @zexpand_caregivers"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="rounded-xl font-bold px-5">
              {saving ? "Saving..." : link?.id ? "Save Changes" : "Add Account Link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}