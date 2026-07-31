export interface FilterState {
  campaign: string;
  channel: string;
  approach: string;
  branch: string;
  members: string[];
  date: string;
}

export const initialFilters: FilterState = {
  campaign: "All",
  channel: "All",
  approach: "All",
  branch: "All",
  members: [],
  date: "All time",
};

export function applyFilters<
  T extends {
    campaign: string;
    channel: string;
    approach: string;
    branch: string;
    memberId: string;
    date: string;
  },
>(rows: T[], f: FilterState): T[] {
  const now = Date.now();
  const days: Record<string, number | null> = {
    Today: 1,
    "Last 7 days": 7,
    "Last 30 days": 30,
    "Last 90 days": 90,
    "All time": null,
  };
  const win = days[f.date] ?? null;
  return rows.filter((r) => {
    if (f.campaign !== "All" && r.campaign !== f.campaign) return false;
    if (f.channel !== "All" && r.channel !== f.channel) return false;
    if (f.approach !== "All" && r.approach !== f.approach) return false;
    if (f.branch !== "All" && r.branch !== f.branch) return false;
    if (f.members.length > 0 && !f.members.includes(r.memberId)) return false;
    if (win !== null) {
      const age = (now - new Date(r.date).getTime()) / 86400000;
      if (age > win) return false;
    }
    return true;
  });
}
