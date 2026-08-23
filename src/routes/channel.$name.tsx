import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProofThumbnail } from "@/components/proof-thumbnail";
import { SearchableSelect } from "@/components/searchable-select";
import { ExternalLink } from "lucide-react";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/channel/$name")({
  head: ({ params }) => {
    const name = decodeURIComponent(params.name);
    return {
      meta: [
        { title: `${name} — Destination — Zexpand` },
        { name: "description", content: `All marketing activity in ${name}.` },
        { property: "og:title", content: `${name} activity` },
        { property: "og:description", content: `Team breakdown and full history for ${name}.` },
      ],
    };
  },
  component: ChannelPage,
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function ChannelPage() {
  const { name: raw } = Route.useParams();
  const name = decodeURIComponent(raw);
  const { activities, memberById, members } = useStore();
  const [memberFilter, setMemberFilter] = useState("All");

  const rows = useMemo(() => activities.filter((a) => a.destination === name), [activities, name]);

  const stats = useMemo(() => {
    const uniqueMembers = new Set(rows.map((r) => r.memberId));
    const leads = rows.reduce((s, r) => s + r.leads, 0);
    const clients = rows.reduce((s, r) => s + r.clients, 0);
    const last = rows.reduce<Date | null>((acc, r) => {
      const d = new Date(r.date);
      return !acc || d > acc ? d : acc;
    }, null);
    return { posts: rows.length, members: uniqueMembers.size, leads, clients, last };
  }, [rows]);

  const breakdown = useMemo(() => {
    const map = new Map<string, { posts: number; leads: number; clients: number; last: Date | null }>();
    for (const r of rows) {
      const cur = map.get(r.memberId) ?? { posts: 0, leads: 0, clients: 0, last: null };
      cur.posts++;
      cur.leads += r.leads;
      cur.clients += r.clients;
      const d = new Date(r.date);
      if (!cur.last || d > cur.last) cur.last = d;
      map.set(r.memberId, cur);
    }
    return Array.from(map.entries()).map(([memberId, v]) => ({ memberId, ...v }));
  }, [rows]);

  const filtered = memberFilter === "All"
    ? rows
    : rows.filter((r) => memberById(r.memberId)?.name === memberFilter);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={name}
        description="Channel / Destination detail"
        actions={<Badge variant="secondary">Destination</Badge>}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total posts" value={String(stats.posts)} />
        <Stat label="Unique members" value={String(stats.members)} />
        <Stat label="Total leads" value={String(stats.leads)} />
        <Stat label="Total clients" value={String(stats.clients)} />
        <Stat label="Last activity" value={stats.last ? format(stats.last, "d MMM") : "—"} />
      </div>
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Team member breakdown</h2>
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Team Member</TableHead>
                <TableHead className="text-right">Posts</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Clients</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.map((b) => {
                const m = memberById(b.memberId);
                return (
                  <TableRow key={b.memberId}>
                    <TableCell>
                      {m && (
                        <Link to="/member/$id" params={{ id: m.id }} className="font-medium hover:underline">
                          {m.name}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.posts}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.leads}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.clients}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {b.last ? format(b.last, "d MMM") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Full marketing history</h2>
          <SearchableSelect
            label="Team Member"
            options={members.map((m) => m.name)}
            value={memberFilter}
            onChange={setMemberFilter}
          />
        </div>
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Date</TableHead>
                  <TableHead>Team Member</TableHead>
                  <TableHead className="min-w-[280px]">Content</TableHead>
                  <TableHead>Proof</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Clients</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const m = memberById(r.memberId);
                  return (
                    <TableRow key={r.id} className="align-top">
                      <TableCell className="whitespace-nowrap text-xs font-semibold text-slate-200">
                        {format(new Date(r.date), "d MMM")}
                      </TableCell>
                      <TableCell className="text-sm font-bold text-white">{m?.name}</TableCell>
                      <TableCell>
                        <details>
                          <summary className="cursor-pointer list-none text-sm text-slate-100"><span className="line-clamp-2">{r.content}</span></summary>
                        </details>
                        <div className="mt-1 text-xs text-slate-300">{r.summary}</div>
                      </TableCell>
                      <TableCell><ProofThumbnail src={r.proof} /></TableCell>
                      <TableCell>
                        {r.publishedLink && (
                          <a href={r.publishedLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            Open <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.cost > 0 ? `$${r.cost}` : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.leads}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.clients}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </div>
  );
}