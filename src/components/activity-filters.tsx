import { useMemo } from "react";
import { SearchableSelect } from "@/components/searchable-select";
import { MultiSelect } from "@/components/multi-select";
import { Button } from "@/components/ui/button";
import { Bookmark, Filter } from "lucide-react";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import {
  FilterState,
  initialFilters,
  applyFilters,
} from "@/lib/activity-filter-utils";

export type { FilterState };
export { initialFilters, applyFilters };

export function ActivityFilters({
  value,
  onChange,
}: {
  value: FilterState;
  onChange: (v: FilterState) => void;
}) {
  const { members, campaigns, activities } = useStore();

  const campaignOptions = useMemo(() => {
    const list = Array.from(
      new Set([
        ...campaigns.map((c) => c.name),
        ...activities.map((a) => a.campaign),
      ]),
    ).filter(Boolean);
    return list;
  }, [campaigns, activities]);

  const channelOptions = useMemo(() => {
    const list = Array.from(
      new Set([
        ...activities.map((a) => a.channel),
      ]),
    ).filter(Boolean);
    return list.length > 0
      ? list
      : ["Facebook", "Instagram", "TikTok", "WhatsApp", "LinkedIn", "Field Visit"];
  }, [activities]);

  const approachOptions = useMemo(() => {
    const relevant =
      value.channel === "All"
        ? activities
        : activities.filter((a) => a.channel === value.channel);
    const list = Array.from(new Set(relevant.map((a) => a.approach))).filter(Boolean);
    return list.length > 0
      ? list
      : ["Organic Post", "Paid Ad", "Group Post", "Story", "Broadcast", "Church Visit"];
  }, [activities, value.channel]);

  const branchOptions = useMemo(() => {
    const list = Array.from(
      new Set([
        ...members.map((m) => m.branch),
        ...activities.map((a) => a.branch),
      ]),
    ).filter((b): b is string => Boolean(b));
    return list;
  }, [members, activities]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchableSelect
        label="Campaign"
        options={campaignOptions}
        value={value.campaign}
        onChange={(v) => onChange({ ...value, campaign: v })}
      />
      <SearchableSelect
        label="Channel"
        options={channelOptions}
        value={value.channel}
        onChange={(v) => onChange({ ...value, channel: v, approach: "All" })}
      />
      <SearchableSelect
        label="Approach"
        options={approachOptions}
        value={value.approach}
        onChange={(v) => onChange({ ...value, approach: v })}
      />
      <SearchableSelect
        label="Branch"
        options={branchOptions}
        value={value.branch}
        onChange={(v) => onChange({ ...value, branch: v })}
      />
      <MultiSelect
        label="Team Members"
        options={members.map((m) => ({ value: m.id, label: m.name }))}
        values={value.members}
        onChange={(m) => onChange({ ...value, members: m })}
      />
      <SearchableSelect
        label="Dates"
        options={["Today", "Last 7 days", "Last 30 days", "Last 90 days", "All time"]}
        value={value.date}
        onChange={(v) => onChange({ ...value, date: v })}
        allLabel="All time"
      />
      <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs">
        <Filter className="h-3.5 w-3.5" /> More Filters
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 text-xs"
        onClick={() => toast.success("View saved")}
      >
        <Bookmark className="h-3.5 w-3.5" /> Save View
      </Button>
    </div>
  );
}