import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Users2, Settings, Link2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/more")({
  head: () => ({
    meta: [
      { title: "More — Zexpand" },
      { name: "description", content: "Approvals, Leads, and Settings." },
    ],
  }),
  component: MorePage,
});

const items = [
  { title: "Approvals", url: "/approvals", icon: CheckCircle2 },
  { title: "Company Links", url: "/company-links", icon: Link2 },
  { title: "Leads", url: "/leads", icon: Users2 },
  { title: "Settings", url: "/settings", icon: Settings },
];

function MorePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="More" />
      <div className="grid gap-3">
        {items.map((i) => (
          <Link
            key={i.url}
            to={i.url}
            className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <i.icon className="h-5 w-5" />
            </div>
            <span className="font-medium">{i.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}