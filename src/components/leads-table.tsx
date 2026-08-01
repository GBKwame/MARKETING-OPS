import { useState, useMemo, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
  X,
  Check,
  Calendar as CalendarIcon,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay, subDays } from "date-fns";
import type { Lead } from "@/lib/store";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { ExpandableText } from "@/components/ui/expandable-text";
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

export type LeadColumnKey =
  | "campaign"
  | "channel"
  | "approach"
  | "destination"
  | "member"
  | "branch"
  | "date"
  | "name"
  | "contact"
  | "comments";

export interface LeadColumnConfig {
  key: LeadColumnKey;
  label: string;
  defaultVisible: boolean;
  filterable?: boolean;
}

export const ALL_LEAD_COLUMNS: LeadColumnConfig[] = [
  { key: "campaign", label: "Campaign", defaultVisible: true, filterable: true },
  { key: "name", label: "Name", defaultVisible: true, filterable: false },
  { key: "contact", label: "Contact", defaultVisible: true, filterable: false },
  { key: "channel", label: "Channel", defaultVisible: true, filterable: true },
  { key: "approach", label: "Approach", defaultVisible: true, filterable: true },
  { key: "destination", label: "Destination", defaultVisible: true, filterable: true },
  { key: "member", label: "Team Member", defaultVisible: true, filterable: true },
  { key: "branch", label: "Branch", defaultVisible: true, filterable: true },
  { key: "date", label: "Date", defaultVisible: true, filterable: true },
  { key: "comments", label: "Comments", defaultVisible: true, filterable: false },
];

const LOCAL_STORAGE_KEY = "leads_column_visibility_v1";

function getDefaultVisibilityMap(): Record<LeadColumnKey, boolean> {
  const map: Partial<Record<LeadColumnKey, boolean>> = {};
  ALL_LEAD_COLUMNS.forEach((col) => {
    map[col.key] = col.defaultVisible;
  });
  return map as Record<LeadColumnKey, boolean>;
}

export function LeadsTable({
  leads,
  onEditLead,
}: {
  leads: Lead[];
  onEditLead?: (lead: Lead) => void;
}) {
  const { memberById, members, campaigns, branches, deleteLead, searchQuery, setSearchQuery } = useStore();
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState<Record<LeadColumnKey, boolean>>(
    getDefaultVisibilityMap
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        setColumnVisibility(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const toggleColumn = (key: LeadColumnKey) => {
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
  const [destinationFilter, setDestinationFilter] = useState("All");
  const [memberFilter, setMemberFilter] = useState("All");
  const [branchFilter, setBranchFilter] = useState("All");

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<string>("All Time");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);

  // Dynamic dropdown options
  const campaignOptions = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach((c) => set.add(c.name));
    leads.forEach((l) => { if (l.campaign) set.add(l.campaign); });
    return Array.from(set).sort();
  }, [campaigns, leads]);

  const channelOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => { if (l.channel) set.add(l.channel); });
    return Array.from(set).sort();
  }, [leads]);

  const approachOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => { if (l.approach) set.add(l.approach); });
    return Array.from(set).sort();
  }, [leads]);

  const destinationOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => { if (l.destination) set.add(l.destination); });
    return Array.from(set).sort();
  }, [leads]);

  const memberOptions = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => set.add(m.name));
    leads.forEach((l) => {
      const m = memberById(l.assignedToId || "");
      if (m?.name) set.add(m.name);
      else if (l.memberName) set.add(l.memberName);
    });
    return Array.from(set).sort();
  }, [members, leads, memberById]);

  const branchOptions = useMemo(() => {
    const set = new Set<string>();
    branches.forEach((b) => set.add(b.name));
    leads.forEach((l) => {
      const b = branches.find((br) => br.id === l.branchId);
      if (b?.name) set.add(b.name);
      else if (l.branch) set.add(l.branch);
    });
    return Array.from(set).sort();
  }, [branches, leads]);

  // Filter Logic
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      // 1. Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const m = memberById(l.assignedToId || "");
        const memberName = m?.name || l.memberName || "";
        const branchObj = branches.find((b) => b.id === l.branchId);
        const branchName = branchObj?.name || l.branch || "";

        const textMatches =
          l.name.toLowerCase().includes(q) ||
          l.contact.toLowerCase().includes(q) ||
          (l.campaign && l.campaign.toLowerCase().includes(q)) ||
          (l.channel && l.channel.toLowerCase().includes(q)) ||
          (l.approach && l.approach.toLowerCase().includes(q)) ||
          (l.destination && l.destination.toLowerCase().includes(q)) ||
          (l.notes && l.notes.toLowerCase().includes(q)) ||
          memberName.toLowerCase().includes(q) ||
          branchName.toLowerCase().includes(q);

        if (!textMatches) return false;
      }

      // 2. Campaign filter
      if (campaignFilter !== "All") {
        if ((l.campaign || "General") !== campaignFilter) return false;
      }

      // 3. Channel filter
      if (channelFilter !== "All") {
        if ((l.channel || "Direct") !== channelFilter) return false;
      }

      // 4. Approach filter
      if (approachFilter !== "All") {
        if ((l.approach || "Organic Post") !== approachFilter) return false;
      }

      // 5. Destination filter
      if (destinationFilter !== "All") {
        if ((l.destination || "Social Media") !== destinationFilter) return false;
      }

      // 6. Member filter
      if (memberFilter !== "All") {
        const m = memberById(l.assignedToId || "");
        const memberName = m?.name || l.memberName || "Team Member";
        if (memberName !== memberFilter) return false;
      }

      // 7. Branch filter
      if (branchFilter !== "All") {
        const b = branches.find((br) => br.id === l.branchId);
        const branchName = b?.name || l.branch || "Accra HQ";
        if (branchName !== branchFilter) return false;
      }

      // 8. Date filter
      if (dateFilter !== "All Time") {
        const itemDate = new Date(l.createdAt);
        const now = new Date();

        if (dateFilter === "Today") {
          const start = startOfDay(now);
          const end = endOfDay(now);
          if (itemDate < start || itemDate > end) return false;
        } else if (dateFilter === "Last 7 Days") {
          const start = startOfDay(subDays(now, 7));
          if (itemDate < start) return false;
        } else if (dateFilter === "Last 30 Days") {
          const start = startOfDay(subDays(now, 30));
          if (itemDate < start) return false;
        } else if (dateFilter === "Custom Range") {
          if (fromDate && itemDate < startOfDay(fromDate)) return false;
          if (toDate && itemDate > endOfDay(toDate)) return false;
        }
      }

      return true;
    });
  }, [
    leads,
    searchQuery,
    campaignFilter,
    channelFilter,
    approachFilter,
    destinationFilter,
    memberFilter,
    branchFilter,
    dateFilter,
    fromDate,
    toDate,
    memberById,
    branches,
  ]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    campaignFilter !== "All" ||
    channelFilter !== "All" ||
    approachFilter !== "All" ||
    destinationFilter !== "All" ||
    memberFilter !== "All" ||
    branchFilter !== "All" ||
    dateFilter !== "All Time";

  const clearAllFilters = () => {
    setSearchQuery("");
    setCampaignFilter("All");
    setChannelFilter("All");
    setApproachFilter("All");
    setDestinationFilter("All");
    setMemberFilter("All");
    setBranchFilter("All");
    setDateFilter("All Time");
    setFromDate(undefined);
    setToDate(undefined);
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

  const visibleCount = ALL_LEAD_COLUMNS.filter((c) => columnVisibility[c.key]).length;

  return (
    <div className="space-y-3">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-2xs">
        {/* Left Section: Active Filter Reset */}
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2 rounded-lg"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Clear Filters
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Showing <strong className="text-foreground">{filteredLeads.length}</strong> of {leads.length} leads
          </span>

          {/* Columns Visibility Dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-semibold cursor-pointer rounded-lg">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Columns
                <Badge variant="secondary" className="h-4 px-1 text-[10px] font-bold">
                  {visibleCount}
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-3 text-xs shadow-xl rounded-xl">
              <div className="flex items-center justify-between border-b pb-2 mb-2 font-semibold">
                <span>Toggle Columns</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetToDefaultView}
                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Reset
                </Button>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {ALL_LEAD_COLUMNS.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 text-xs font-medium cursor-pointer hover:bg-muted/50 p-1 rounded-md transition-colors"
                  >
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

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b">
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

              {/* Name */}
              {columnVisibility.name && (
                <TableHead className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-3">
                  Name
                </TableHead>
              )}

              {/* Contact */}
              {columnVisibility.contact && (
                <TableHead className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-3">
                  Contact
                </TableHead>
              )}

              {/* Channel */}
              {columnVisibility.channel && (
                <TableHead className="min-w-[120px]">
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
                <TableHead className="min-w-[130px]">
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
                <TableHead className="min-w-[140px]">
                  <HeaderFilterButton
                    label="Destination"
                    value={destinationFilter}
                    options={destinationOptions}
                    onChange={setDestinationFilter}
                  />
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

              {/* Date */}
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

              {/* Comments */}
              {columnVisibility.comments && (
                <TableHead className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-3">
                  Comments
                </TableHead>
              )}

              {/* ACTIONS Header */}
              <TableHead className="text-right text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-3 min-w-[90px]">
                ACTIONS
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCount + 1} className="h-32 text-center text-xs text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <p>No leads match your criteria.</p>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={clearAllFilters} className="h-8 text-xs gap-1.5 rounded-lg">
                        <RotateCcw className="h-3.5 w-3.5" /> Clear All Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((l) => {
                const assignedMember = memberById(l.assignedToId || "") || (l.memberName ? { name: l.memberName } : null);
                const assignedBranch = branches.find((b) => b.id === l.branchId) || (l.branch ? { name: l.branch } : null);

                return (
                  <TableRow key={l.id} className="hover:bg-muted/20 transition-colors">
                    {columnVisibility.campaign && (
                      <TableCell className="px-3 py-3 text-xs font-semibold">{l.campaign || "General"}</TableCell>
                    )}
                    {columnVisibility.name && (
                      <TableCell className="px-3 py-3 text-xs font-bold text-foreground">{l.name}</TableCell>
                    )}
                    {columnVisibility.contact && (
                      <TableCell className="px-3 py-3 text-xs text-muted-foreground">{l.contact}</TableCell>
                    )}
                    {columnVisibility.channel && (
                      <TableCell className="px-3 py-3 text-xs text-muted-foreground">{l.channel || "Direct"}</TableCell>
                    )}
                    {columnVisibility.approach && (
                      <TableCell className="px-3 py-3 text-xs text-muted-foreground">{l.approach || "Organic Post"}</TableCell>
                    )}
                    {columnVisibility.destination && (
                      <TableCell className="px-3 py-3 text-xs font-medium text-primary">{l.destination || "Social Media"}</TableCell>
                    )}
                    {columnVisibility.member && (
                      <TableCell className="px-3 py-3 text-xs font-medium">{assignedMember?.name || "Team Member"}</TableCell>
                    )}
                    {columnVisibility.branch && (
                      <TableCell className="px-3 py-3 text-xs text-muted-foreground">{assignedBranch?.name || "Accra HQ"}</TableCell>
                    )}
                    {columnVisibility.date && (
                      <TableCell className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(l.createdAt), "dd MMM yyyy")}
                      </TableCell>
                    )}
                    {columnVisibility.comments && (
                      <TableCell className="px-3 py-3">
                        <ExpandableText text={l.notes || l.comments} title="Lead Remarks & Comments" maxLength={45} />
                      </TableCell>
                    )}
                    <TableCell className="text-right px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {onEditLead && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                            title="Edit Lead"
                            onClick={() => onEditLead(l)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                          title="Delete Lead"
                          onClick={() => setLeadToDelete(l)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
  const isFiltered = value !== "All";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors cursor-pointer group">
          <span className={isFiltered ? "text-primary font-bold" : ""}>{label}</span>
          {isFiltered && (
            <Badge variant="secondary" className="h-3.5 px-1 text-[9px] font-bold bg-primary/10 text-primary border-primary/20">
              Active
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-transform" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1.5 text-xs shadow-xl rounded-xl">
        <div className="space-y-0.5">
          <button
            onClick={() => onChange("All")}
            className="flex items-center justify-between w-full px-2 py-1.5 rounded-md hover:bg-muted text-left cursor-pointer transition-colors"
          >
            <span>All {label}s</span>
            {value === "All" && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
          <div className="my-1 border-t" />
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {options.map((opt) => {
              const isSelected = value === opt;
              return (
                <button
                  key={opt}
                  onClick={() => onChange(opt)}
                  className="flex items-center justify-between w-full px-2 py-1.5 rounded-md hover:bg-muted text-left cursor-pointer transition-colors"
                >
                  <span className="truncate pr-2">{opt}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
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
  fromDate: Date | undefined;
  setFromDate: (date: Date | undefined) => void;
  toDate: Date | undefined;
  setToDate: (date: Date | undefined) => void;
}) {
  const isFiltered = dateFilter !== "All Time";
  const [range, setRange] = useState<DateRange | undefined>({
    from: fromDate,
    to: toDate,
  });

  const presetOptions = ["All Time", "Today", "Last 7 Days", "Last 30 Days", "Custom Range"];

  const handleSelectPreset = (preset: string) => {
    setDateFilter(preset);
    if (preset !== "Custom Range") {
      setFromDate(undefined);
      setToDate(undefined);
      setRange(undefined);
    }
  };

  const handleApplyCustomRange = () => {
    if (range?.from) {
      setFromDate(range.from);
      setToDate(range.to || range.from);
      setDateFilter("Custom Range");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors cursor-pointer group">
          <span className={isFiltered ? "text-primary font-bold" : ""}>Date</span>
          {isFiltered && (
            <Badge variant="secondary" className="h-3.5 px-1 text-[9px] font-bold bg-primary/10 text-primary border-primary/20">
              Active
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-transform" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3 text-xs shadow-xl rounded-xl">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1 border-b pb-2">
            {presetOptions.map((opt) => (
              <Button
                key={opt}
                variant={dateFilter === opt ? "default" : "outline"}
                size="sm"
                onClick={() => handleSelectPreset(opt)}
                className="h-7 text-[11px] px-2 rounded-lg"
              >
                {opt}
              </Button>
            ))}
          </div>

          {dateFilter === "Custom Range" && (
            <div className="space-y-2">
              <Calendar
                mode="range"
                selected={range}
                onSelect={setRange}
                numberOfMonths={1}
                className="rounded-md border shadow-2xs"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-muted-foreground">
                  {range?.from ? format(range.from, "PP") : "Start"}{" "}
                  {range?.to ? ` - ${format(range.to, "PP")}` : ""}
                </span>
                <Button size="sm" onClick={handleApplyCustomRange} className="h-7 text-xs px-3 rounded-lg">
                  Apply
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
