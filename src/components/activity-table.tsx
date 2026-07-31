import { useState, useMemo, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProofThumbnail } from "@/components/proof-thumbnail";
import {
  ChevronDown,
  ExternalLink,
  MoreVertical,
  RotateCcw,
  SlidersHorizontal,
  X,
  Check,
  Calendar as CalendarIcon,
  Pencil,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import type { Activity } from "@/lib/store";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";

export type ColumnKey =
  | "campaign"
  | "channel"
  | "approach"
  | "destination"
  | "content"
  | "member"
  | "branch"
  | "date"
  | "proof"
  | "link"
  | "cost"
  | "leads"
  | "clients";

export interface ColumnConfig {
  key: ColumnKey;
  label: string;
  defaultVisible: boolean;
  filterable?: boolean;
}

export const ALL_COLUMNS: ColumnConfig[] = [
  { key: "campaign", label: "Campaign", defaultVisible: true, filterable: true },
  { key: "channel", label: "Channel", defaultVisible: true, filterable: true },
  { key: "approach", label: "Approach", defaultVisible: false, filterable: true },
  { key: "destination", label: "Destination", defaultVisible: true, filterable: false },
  { key: "content", label: "Content", defaultVisible: false, filterable: false },
  { key: "member", label: "Team Member", defaultVisible: true, filterable: true },
  { key: "branch", label: "Branch", defaultVisible: true, filterable: true },
  { key: "date", label: "Date", defaultVisible: true, filterable: true },
  { key: "proof", label: "Proof", defaultVisible: true, filterable: false },
  { key: "link", label: "Link", defaultVisible: false, filterable: false },
  { key: "cost", label: "Cost", defaultVisible: true, filterable: false },
  { key: "leads", label: "Leads", defaultVisible: true, filterable: false },
  { key: "clients", label: "Clients", defaultVisible: true, filterable: false },
];

const LOCAL_STORAGE_KEY = "mo-activity-table-columns-v3";

function getDefaultVisibilityMap(): Record<ColumnKey, boolean> {
  return ALL_COLUMNS.reduce(
    (acc, col) => ({ ...acc, [col.key]: col.defaultVisible }),
    {} as Record<ColumnKey, boolean>,
  );
}

export function ActivityTable({
  activities,
  dense = false,
  hideActions = false,
  onEditActivity,
}: {
  activities: Activity[];
  dense?: boolean;
  hideActions?: boolean;
  onEditActivity?: (activity: Activity) => void;
}) {
  const { memberById, members, campaigns, searchQuery, setSearchQuery, deleteActivity, updateActivity } = useStore();
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Built-in Edit Modal State
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [updating, setUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    campaign: "",
    channel: "",
    branchId: "",
    approach: "",
    destination: "",
    content: "",
    cost: "",
    leads: "",
    clients: "",
    proofUrl: "",
    publishedLink: "",
  });

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity) return;
    setUpdating(true);
    try {
      await updateActivity(editingActivity.id, {
        campaign: editForm.campaign,
        channel: editForm.channel,
        approach: editForm.approach,
        destination: editForm.destination,
        content: editForm.content,
        cost: Number(editForm.cost) || 0,
        leads: Number(editForm.leads) || 0,
        clients: Number(editForm.clients) || 0,
        proofUrl: editForm.proofUrl,
        publishedLink: editForm.publishedLink,
      });
      toast.success("Activity updated successfully!");
      setEditingActivity(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update activity");
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!activityToDelete) return;
    setDeleting(true);
    try {
      await deleteActivity(activityToDelete.id);
      toast.success("Activity deleted successfully!");
      setActivityToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete activity");
    } finally {
      setDeleting(false);
    }
  };

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>(
    getDefaultVisibilityMap,
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        setColumnVisibility(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const toggleColumn = (key: ColumnKey) => {
    setColumnVisibility((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetToDefaultView = () => {
    const defaults = getDefaultVisibilityMap();
    setColumnVisibility(defaults);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {}
  };

  // Inline Column Filter State
  const [campaignFilter, setCampaignFilter] = useState("All");
  const [channelFilter, setChannelFilter] = useState("All");
  const [approachFilter, setApproachFilter] = useState("All");
  const [memberFilter, setMemberFilter] = useState("All");
  const [branchFilter, setBranchFilter] = useState("All");

  // Date Filter State (Presets + Custom From/To Range)
  const [dateFilter, setDateFilter] = useState("All time");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Dynamic filter options
  const campaignOptions = useMemo(
    () => Array.from(new Set([...campaigns.map((c) => c.name), ...activities.map((a) => a.campaign)])),
    [campaigns, activities],
  );
  const channelOptions = useMemo(
    () => Array.from(new Set(activities.map((a) => a.channel))),
    [activities],
  );
  const approachOptions = useMemo(
    () => Array.from(new Set(activities.map((a) => a.approach))),
    [activities],
  );
  const memberOptions = useMemo(
    () => members.map((m) => m.name),
    [members],
  );
  const branchOptions = useMemo(
    () => Array.from(new Set([...members.map((m) => m.branch), ...activities.map((a) => a.branch)])).filter((b): b is string => Boolean(b)),
    [members, activities],
  );

  // Filter activities
  const filteredActivities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const daysMap: Record<string, number | null> = {
      Today: 1,
      "Last 7 days": 7,
      "Last 30 days": 30,
      "Last 90 days": 90,
      "All time": null,
    };

    return activities.filter((a) => {
      if (campaignFilter !== "All" && a.campaign !== campaignFilter) return false;
      if (channelFilter !== "All" && a.channel !== channelFilter) return false;
      if (approachFilter !== "All" && a.approach !== approachFilter) return false;
      if (branchFilter !== "All" && a.branch !== branchFilter) return false;

      if (memberFilter !== "All") {
        const m = memberById(a.memberId);
        if (!m || m.name !== memberFilter) return false;
      }

      // Date Filtering (Custom Range vs Preset Window)
      const actTime = new Date(a.date).getTime();

      if (dateFilter === "Custom Range") {
        if (fromDate) {
          const startTime = new Date(fromDate + "T00:00:00").getTime();
          if (actTime < startTime) return false;
        }
        if (toDate) {
          const endTime = new Date(toDate + "T23:59:59").getTime();
          if (actTime > endTime) return false;
        }
      } else {
        const dateWin = daysMap[dateFilter] ?? null;
        if (dateWin !== null) {
          const age = (now - actTime) / 86400000;
          if (age > dateWin) return false;
        }
      }

      if (query) {
        const mName = memberById(a.memberId)?.name.toLowerCase() ?? "";
        const matches =
          a.campaign.toLowerCase().includes(query) ||
          a.channel.toLowerCase().includes(query) ||
          a.approach.toLowerCase().includes(query) ||
          a.destination.toLowerCase().includes(query) ||
          a.content.toLowerCase().includes(query) ||
          a.branch.toLowerCase().includes(query) ||
          mName.includes(query);

        if (!matches) return false;
      }

      return true;
    });
  }, [
    activities,
    campaignFilter,
    channelFilter,
    approachFilter,
    memberFilter,
    branchFilter,
    dateFilter,
    fromDate,
    toDate,
    searchQuery,
    memberById,
  ]);

  const hasActiveFilters =
    campaignFilter !== "All" ||
    channelFilter !== "All" ||
    approachFilter !== "All" ||
    memberFilter !== "All" ||
    branchFilter !== "All" ||
    dateFilter !== "All time" ||
    fromDate !== "" ||
    toDate !== "" ||
    searchQuery !== "";

  const clearAllFilters = () => {
    setCampaignFilter("All");
    setChannelFilter("All");
    setApproachFilter("All");
    setMemberFilter("All");
    setBranchFilter("All");
    setDateFilter("All time");
    setFromDate("");
    setToDate("");
    setSearchQuery("");
  };

  const visibleCount = ALL_COLUMNS.filter((c) => columnVisibility[c.key]).length;

  return (
    <div className="space-y-3">
      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border bg-card p-3 shadow-xs">
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3 w-3" /> Clear Filters
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Showing <strong className="text-foreground">{filteredActivities.length}</strong> of {activities.length} activities
          </span>

          {/* Columns Visibility Dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-semibold">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Columns
                <Badge variant="secondary" className="h-4 px-1 text-[10px] font-bold">
                  {visibleCount}
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-3 text-xs shadow-xl">
              <div className="flex items-center justify-between border-b pb-2 mb-2 font-semibold">
                <span>Toggle Columns</span>
                <Button variant="ghost" size="sm" onClick={resetToDefaultView} className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground">
                  Reset
                </Button>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {ALL_COLUMNS.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 text-xs font-medium cursor-pointer hover:bg-muted/50 p-1 rounded-md transition-colors">
                    <Checkbox
                      checked={columnVisibility[col.key]}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent border-b">
              {/* Campaign */}
              {columnVisibility.campaign && (
                <TableHead className="min-w-[130px]">
                  <HeaderFilterButton
                    label="Campaign"
                    value={campaignFilter}
                    options={campaignOptions}
                    onChange={setCampaignFilter}
                  />
                </TableHead>
              )}

              {/* Channel */}
              {columnVisibility.channel && (
                <TableHead className="min-w-[110px]">
                  <HeaderFilterButton
                    label="Channel"
                    value={channelFilter}
                    options={channelOptions}
                    onChange={setChannelFilter}
                  />
                </TableHead>
              )}

              {/* Approach */}
              {columnVisibility.approach && (
                <TableHead className="min-w-[120px]">
                  <HeaderFilterButton
                    label="Approach"
                    value={approachFilter}
                    options={approachOptions}
                    onChange={setApproachFilter}
                  />
                </TableHead>
              )}

              {/* Destination */}
              {columnVisibility.destination && (
                <TableHead className="min-w-[140px] text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-3">
                  Destination
                </TableHead>
              )}

              {/* Content */}
              {columnVisibility.content && (
                <TableHead className="min-w-[200px] text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-3">
                  Content
                </TableHead>
              )}

              {/* Team Member */}
              {columnVisibility.member && (
                <TableHead className="min-w-[130px]">
                  <HeaderFilterButton
                    label="Team Member"
                    value={memberFilter}
                    options={memberOptions}
                    onChange={setMemberFilter}
                  />
                </TableHead>
              )}

              {/* Branch */}
              {columnVisibility.branch && (
                <TableHead className="min-w-[120px]">
                  <HeaderFilterButton
                    label="Branch"
                    value={branchFilter}
                    options={branchOptions}
                    onChange={setBranchFilter}
                  />
                </TableHead>
              )}

              {/* Date Column with Custom Range Filter */}
              {columnVisibility.date && (
                <TableHead className="min-w-[130px]">
                  <DateHeaderFilterButton
                    dateFilter={dateFilter}
                    setDateFilter={setDateFilter}
                    fromDate={fromDate}
                    setFromDate={setFromDate}
                    toDate={toDate}
                    setToDate={setToDate}
                  />
                </TableHead>
              )}

              {/* Proof */}
              {columnVisibility.proof && (
                <TableHead className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-3">
                  Proof
                </TableHead>
              )}

              {/* Link */}
              {columnVisibility.link && (
                <TableHead className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-3">
                  Link
                </TableHead>
              )}

              {/* Cost */}
              {columnVisibility.cost && (
                <TableHead className="text-right text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-3">
                  Cost
                </TableHead>
              )}

              {/* Leads */}
              {columnVisibility.leads && (
                <TableHead className="text-right text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-3">
                  Leads
                </TableHead>
              )}

              {/* Clients */}
              {columnVisibility.clients && (
                <TableHead className="text-right text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-3">
                  Clients
                </TableHead>
              )}

              {/* ACTIONS Header */}
              {!hideActions && (
                <TableHead className="text-right text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-3 min-w-[90px]">
                  ACTIONS
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredActivities.length === 0 && (
              <TableRow>
                <TableCell colSpan={visibleCount || 1} className="h-32 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <p>No marketing activity matches your criteria.</p>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={clearAllFilters} className="h-8 text-xs gap-1.5">
                        <RotateCcw className="h-3.5 w-3.5" /> Clear All Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {filteredActivities.map((a) => {
              const m = memberById(a.memberId);
              return (
                <TableRow key={a.id} className="align-top hover:bg-muted/30 transition-colors">
                  {columnVisibility.campaign && (
                    <TableCell className="font-medium text-xs px-3 py-3">{a.campaign}</TableCell>
                  )}

                  {columnVisibility.channel && (
                    <TableCell className="px-3 py-3">
                      <Badge variant="secondary" className="font-normal text-[11px]">
                        {a.channel}
                      </Badge>
                    </TableCell>
                  )}

                  {columnVisibility.approach && (
                    <TableCell className="text-xs text-muted-foreground px-3 py-3">{a.approach}</TableCell>
                  )}

                  {columnVisibility.destination && (
                    <TableCell className="text-xs font-medium text-primary px-3 py-3">{a.destination}</TableCell>
                  )}

                  {columnVisibility.content && (
                    <TableCell className="text-xs max-w-[260px] truncate px-3 py-3" title={a.content}>
                      {a.content}
                    </TableCell>
                  )}

                  {columnVisibility.member && (
                    <TableCell className="text-xs font-medium px-3 py-3">{m?.name ?? a.memberId}</TableCell>
                  )}

                  {columnVisibility.branch && (
                    <TableCell className="text-xs text-muted-foreground px-3 py-3">{a.branch}</TableCell>
                  )}

                  {columnVisibility.date && (
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap px-3 py-3">
                      {format(new Date(a.date), "dd MMM yyyy")}
                    </TableCell>
                  )}

                  {columnVisibility.proof && (
                    <TableCell className="px-3 py-3">
                      <ProofThumbnail src={a.proof} />
                    </TableCell>
                  )}

                  {columnVisibility.link && (
                    <TableCell className="px-3 py-3">
                      {a.publishedLink ? (
                        <a
                          href={a.publishedLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}

                  {columnVisibility.cost && (
                    <TableCell className="text-right text-xs font-medium px-3 py-3">
                      ${a.cost.toLocaleString()}
                    </TableCell>
                  )}

                  {columnVisibility.leads && (
                    <TableCell className="text-right text-xs font-medium px-3 py-3">{a.leads}</TableCell>
                  )}

                  {columnVisibility.clients && (
                    <TableCell className="text-right text-xs font-medium px-3 py-3">{a.clients}</TableCell>
                  )}

                  {/* Actions Cell */}
                  {!hideActions && (
                    <TableCell className="text-right px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                          title="Edit Activity"
                          onClick={() => {
                            if (onEditActivity) {
                              onEditActivity(a);
                            } else {
                              setEditingActivity(a);
                              setEditForm({
                                campaign: a.campaign || "",
                                channel: a.channel || "",
                                branchId: a.branchId || "",
                                approach: a.approach || "",
                                destination: a.destination || "",
                                content: a.content || "",
                                cost: String(a.cost ?? 0),
                                leads: String(a.leads ?? 0),
                                clients: String(a.clients ?? 0),
                                proofUrl: a.proof || "",
                                publishedLink: a.publishedLink || "",
                              });
                            }
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                          title="Delete Activity"
                          onClick={() => setActivityToDelete(a)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!activityToDelete} onOpenChange={(val) => !val && setActivityToDelete(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Confirm Activity Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground">
            Are you sure you want to delete the activity for <span className="font-bold text-foreground">"{activityToDelete?.campaign}"</span> ({activityToDelete?.channel})? This action cannot be undone.
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setActivityToDelete(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              className="rounded-xl font-bold px-4"
              onClick={handleConfirmDelete}
            >
              {deleting ? "Deleting..." : "Delete Activity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Built-in Edit Activity Dialog */}
      <Dialog open={!!editingActivity} onOpenChange={(val) => !val && setEditingActivity(null)}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto p-6 rounded-2xl border bg-card shadow-2xl">
          <form onSubmit={handleSaveEdit}>
            <DialogHeader className="mb-4">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" /> Edit Marketing Activity
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground">CAMPAIGN</label>
                  <Input
                    value={editForm.campaign}
                    onChange={(e) => setEditForm({ ...editForm, campaign: e.target.value })}
                    className="h-9 text-xs rounded-lg mt-1"
                  />
                </div>
                <div>
                  <label className="font-semibold text-muted-foreground">CHANNEL</label>
                  <Input
                    value={editForm.channel}
                    onChange={(e) => setEditForm({ ...editForm, channel: e.target.value })}
                    className="h-9 text-xs rounded-lg mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground">CONTENT / SUMMARY</label>
                <Input
                  value={editForm.content}
                  onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                  className="h-9 text-xs rounded-lg mt-1"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground">COST ($)</label>
                  <Input
                    type="number"
                    value={editForm.cost}
                    onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })}
                    className="h-9 text-xs rounded-lg mt-1"
                  />
                </div>
                <div>
                  <label className="font-semibold text-muted-foreground">LEADS</label>
                  <Input
                    type="number"
                    value={editForm.leads}
                    onChange={(e) => setEditForm({ ...editForm, leads: e.target.value })}
                    className="h-9 text-xs rounded-lg mt-1"
                  />
                </div>
                <div>
                  <label className="font-semibold text-muted-foreground">CLIENTS</label>
                  <Input
                    type="number"
                    value={editForm.clients}
                    onChange={(e) => setEditForm({ ...editForm, clients: e.target.value })}
                    className="h-9 text-xs rounded-lg mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground">PROOF URL</label>
                <Input
                  value={editForm.proofUrl}
                  onChange={(e) => setEditForm({ ...editForm, proofUrl: e.target.value })}
                  className="h-9 text-xs rounded-lg mt-1"
                  placeholder="https://..."
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-5">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingActivity(null)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={updating} className="rounded-xl font-bold px-4">
                {updating ? "Saving..." : "Update Activity"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HeaderFilterButton({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value !== "All" && value !== "All time";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold tracking-wider uppercase transition-all cursor-pointer ${
            active
              ? "bg-primary/15 text-primary border border-primary/30 font-bold"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          title={`Filter by ${label}`}
        >
          <span>{label}</span>
          <ChevronDown
            className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""} ${
              active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"
            }`}
          />
          {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1.5 text-xs shadow-lg">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
          Filter {label}
        </div>
        <div className="max-h-52 overflow-y-auto space-y-0.5">
          <button
            onClick={() => {
              onChange("All");
              setOpen(false);
            }}
            className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
              !active ? "bg-accent font-medium text-accent-foreground" : "hover:bg-muted"
            }`}
          >
            <span>All ({label})</span>
            {!active && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
          {options.map((opt) => {
            const isSelected = value === opt;
            return (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                  isSelected ? "bg-accent font-medium text-accent-foreground" : "hover:bg-muted"
                }`}
              >
                <span className="truncate">{opt}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DateHeaderFilterButton({
  dateFilter,
  setDateFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
}: {
  dateFilter: string;
  setDateFilter: (val: string) => void;
  fromDate: string;
  setFromDate: (val: string) => void;
  toDate: string;
  setToDate: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const presets = ["Today", "Last 7 days", "Last 30 days", "Last 90 days", "All time"];
  const isCustomActive = dateFilter === "Custom Range" || Boolean(fromDate || toDate);
  const active = (dateFilter !== "All time" && dateFilter !== "All") || isCustomActive;

  let displayLabel = "Date";
  if (isCustomActive && (fromDate || toDate)) {
    if (fromDate && toDate) {
      displayLabel = `${format(new Date(fromDate + "T00:00:00"), "dd MMM")} - ${format(new Date(toDate + "T00:00:00"), "dd MMM yyyy")}`;
    } else if (fromDate) {
      displayLabel = `From ${format(new Date(fromDate + "T00:00:00"), "dd MMM yyyy")}`;
    } else if (toDate) {
      displayLabel = `To ${format(new Date(toDate + "T00:00:00"), "dd MMM yyyy")}`;
    }
  } else if (dateFilter !== "All time" && dateFilter !== "All") {
    displayLabel = dateFilter;
  }

  const handleSelectPreset = (preset: string) => {
    setDateFilter(preset);
    setFromDate("");
    setToDate("");
    setOpen(false);
  };

  const handleClear = () => {
    setDateFilter("All time");
    setFromDate("");
    setToDate("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold tracking-wider uppercase transition-all cursor-pointer ${
            active
              ? "bg-primary/15 text-primary border border-primary/30 font-bold"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          title="Filter by Date Range"
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span className="truncate max-w-[130px]">{displayLabel}</span>
          <ChevronDown
            className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""} ${
              active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"
            }`}
          />
          {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-4 text-xs shadow-2xl rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b pb-2 mb-3 px-1 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5 font-bold text-foreground">
            <CalendarIcon className="h-4 w-4 text-primary" /> Filter Date Range
          </span>
          {active && (
            <button onClick={handleClear} className="text-primary hover:underline capitalize text-[11px] font-bold cursor-pointer">
              Reset
            </button>
          )}
        </div>

        {/* Quick Presets */}
        <div className="space-y-1 mb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-1">
            Quick Presets
          </div>
          {presets.map((p) => {
            const isSelected = dateFilter === p && !fromDate && !toDate;
            return (
              <button
                key={p}
                onClick={() => handleSelectPreset(p)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                  isSelected ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "hover:bg-muted text-foreground"
                }`}
              >
                <span>{p}</span>
                {isSelected && <Check className="h-4 w-4 text-primary-foreground" />}
              </button>
            );
          })}
        </div>

        {/* Date Pickers (From Date & To Date) */}
        <div className="border-t pt-3 space-y-3 bg-muted/30 p-3 rounded-xl border">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Custom Date Range Picker
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                <span>FROM DATE</span>
                {fromDate && <span className="text-primary font-semibold text-[11px]">{fromDate}</span>}
              </label>
              <div className="relative mt-1">
                <Input
                  id="from-date-picker-input"
                  type="date"
                  value={fromDate}
                  onClick={(e) => {
                    if ("showPicker" in e.currentTarget) {
                      try { e.currentTarget.showPicker(); } catch {}
                    }
                  }}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setDateFilter("Custom Range");
                  }}
                  className="h-10 text-xs font-semibold bg-background pr-10 rounded-xl cursor-pointer border-input focus:border-primary transition-all dark:[color-scheme:dark] [color-scheme:light] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("from-date-picker-input") as HTMLInputElement;
                    if (el && "showPicker" in el) {
                      try { el.showPicker(); } catch {}
                    }
                  }}
                  className="absolute right-3 top-2.5 text-primary hover:text-primary/80 cursor-pointer pointer-events-auto"
                  title="Pick From Date"
                >
                  <CalendarIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                <span>TO DATE</span>
                {toDate && <span className="text-primary font-semibold text-[11px]">{toDate}</span>}
              </label>
              <div className="relative mt-1">
                <Input
                  id="to-date-picker-input"
                  type="date"
                  value={toDate}
                  onClick={(e) => {
                    if ("showPicker" in e.currentTarget) {
                      try { e.currentTarget.showPicker(); } catch {}
                    }
                  }}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setDateFilter("Custom Range");
                  }}
                  className="h-10 text-xs font-semibold bg-background pr-10 rounded-xl cursor-pointer border-input focus:border-primary transition-all dark:[color-scheme:dark] [color-scheme:light] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("to-date-picker-input") as HTMLInputElement;
                    if (el && "showPicker" in el) {
                      try { el.showPicker(); } catch {}
                    }
                  }}
                  className="absolute right-3 top-2.5 text-primary hover:text-primary/80 cursor-pointer pointer-events-auto"
                  title="Pick To Date"
                >
                  <CalendarIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={handleClear}
            >
              Clear
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs font-bold px-5 rounded-xl shadow-sm cursor-pointer"
              onClick={() => setOpen(false)}
            >
              Apply Filter
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}