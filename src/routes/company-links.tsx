import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  Link2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useStore, type CompanyLink } from "@/lib/store";

export const Route = createFileRoute("/company-links")({
  head: () => ({
    meta: [
      { title: "Company Links — MarketOps" },
      { name: "description", content: "Official company accounts and handles for your workspace." },
      { property: "og:title", content: "Company Links — MarketOps" },
      { property: "og:description", content: "Quickly open the correct company accounts across every channel." },
    ],
  }),
  component: CompanyLinksPage,
});

type Platform = CompanyLink["platform"];

const PLATFORM_META: Record<Platform, { icon: React.ComponentType<{ className?: string }>; tint: string }> = {
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

const PLATFORM_ORDER: Platform[] = [
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
  const { currentUser, companyLinks, updateCompanyLink } = useStore();
  const canEdit = currentUser?.role === "admin" || currentUser?.role === "manager";

  const links = useMemo(() => {
    const byPlatform = new Map(companyLinks.map((l) => [l.platform, l]));
    return PLATFORM_ORDER.map((p) => byPlatform.get(p) ?? { platform: p, url: null });
  }, [companyLinks]);

  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);
  const [editing, setEditing] = useState<CompanyLink | null>(null);

  const activeCount = useMemo(() => links.filter((l) => l.url).length, [links]);

  const handleCopy = async (link: CompanyLink) => {
    if (!link.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedPlatform(link.platform);
      toast.success(`${link.platform} link copied`);
      setTimeout(() => setCopiedPlatform((p) => (p === link.platform ? null : p)), 1500);
    } catch {
      toast.error("Couldn't copy — try again");
    }
  };

  const handleSave = async (platform: string, url: string, handle: string) => {
    const trimmedUrl = url.trim();
    const trimmedHandle = handle.trim();
    await updateCompanyLink(platform, trimmedUrl || null, trimmedHandle || undefined);
    setEditing(null);
    toast.success(`${platform} updated`);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Company Links"
        description={`${activeCount} of ${links.length} platforms connected`}
        actions={
          !canEdit ? (
            <span className="hidden text-xs text-muted-foreground sm:inline">View-only access</span>
          ) : undefined
        }
      />

      {/* Desktop / tablet table */}
      <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-sm sm:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Platform</th>
              <th className="px-5 py-3 text-left font-medium">Link / Handle</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {links.map((link) => {
              const meta = PLATFORM_META[link.platform];
              const Icon = meta.icon;
              const isCopied = copiedPlatform === link.platform;
              return (
                <tr key={link.platform} className="transition-colors hover:bg-muted/30">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`grid h-9 w-9 place-items-center rounded-xl ${meta.tint}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="font-medium">{link.platform}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {link.url ? (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-[360px] items-center gap-1.5 truncate font-medium text-primary hover:underline"
                      >
                        <span className="truncate">{link.handle ?? link.url}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground/60">N/A</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {link.url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleCopy(link)}
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" /> Copy
                            </>
                          )}
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setEditing(link)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 sm:hidden">
        {links.map((link) => {
          const meta = PLATFORM_META[link.platform];
          const Icon = meta.icon;
          const isCopied = copiedPlatform === link.platform;
          return (
            <div key={link.platform} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${meta.tint}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{link.platform}</div>
                  {link.url ? (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-xs text-primary hover:underline"
                    >
                      {link.handle ?? link.url}
                    </a>
                  ) : (
                    <div className="text-xs text-muted-foreground/60">N/A</div>
                  )}
                </div>
              </div>
              {(link.url || canEdit) && (
                <div className="mt-3 flex items-center gap-2">
                  {link.url && (
                    <Button variant="secondary" size="sm" className="flex-1 gap-1.5" onClick={() => handleCopy(link)}>
                      {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {isCopied ? "Copied" : "Copy"}
                    </Button>
                  )}
                  {link.url && (
                    <Button asChild variant="secondary" size="sm" className="flex-1 gap-1.5">
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Open
                      </a>
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setEditing(link)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!canEdit && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden">
          <Link2 className="h-3.5 w-3.5" /> View-only — ask a manager to update links.
        </p>
      )}

      <EditLinkDialog
        link={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
    </div>
  );
}

function EditLinkDialog({
  link,
  onClose,
  onSave,
}: {
  link: CompanyLink | null;
  onClose: () => void;
  onSave: (platform: string, url: string, handle: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [handle, setHandle] = useState("");

  return (
    <Dialog
      open={!!link}
      onOpenChange={(open) => {
        if (!open) onClose();
        if (open && link) {
          setUrl(link.url ?? "");
          setHandle(link.handle ?? "");
        }
      }}
    >
      <DialogTrigger className="hidden" />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {link?.platform}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="link-url">Link</Label>
            <Input
              id="link-url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Leave empty to mark as N/A.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link-handle">Display handle (optional)</Label>
            <Input
              id="link-handle"
              placeholder="@your_handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => link && onSave(link.platform, url, handle)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}