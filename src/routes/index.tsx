import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useEffect } from "react";
import {
  RadioTower,
  PieChart,
  Receipt,
  Target,
  Building2,
  Gauge,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { ActivityTable } from "@/components/activity-table";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Zexpand" },
      { name: "description", content: "KPI overview across campaigns, spend, leads, and conversions." },
      { property: "og:title", content: "Zexpand Dashboard" },
      { property: "og:description", content: "Marketing operations at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { currentUser, activities, totalBudget } = useStore();
  const navigate = useNavigate();
  const isMarketer = currentUser?.role === "marketer";

  useEffect(() => {
    if (currentUser?.role === "super_admin") {
      navigate({ to: "/super-admin" });
    }
  }, [currentUser, navigate]);

  const totals = useMemo(() => {
    const campaigns = new Set(activities.map((a) => a.campaign)).size;
    const spend = activities.reduce((s, a) => s + a.cost, 0);
    const leads = activities.reduce((s, a) => s + a.leads, 0);
    const clients = activities.reduce((s, a) => s + a.clients, 0);
    const cvr = leads > 0 ? Math.round((clients / leads) * 100) : 0;
    return { campaigns, spend, leads, clients, cvr };
  }, [activities]);

  const personalStats = useMemo(() => {
    if (!currentUser) return null;
    const myActs = activities.filter((a) => a.memberId === currentUser.id);
    const myLeads = myActs.reduce((s, a) => s + a.leads, 0);
    const myClients = myActs.reduce((s, a) => s + a.clients, 0);
    return { count: myActs.length, leads: myLeads, clients: myClients };
  }, [activities, currentUser]);

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "super_admin";

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Dashboard"
        description="Real-time marketing operations across your team."
      />

      {isMarketer && personalStats && (
        <div className="mb-4 rounded-xl border bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300">
          <span className="font-bold">Your Personal Impact:</span> You have logged{" "}
          <strong>{personalStats.count} activities</strong>, generated <strong>{personalStats.leads} leads</strong>, and converted <strong>{personalStats.clients} clients</strong>!
        </div>
      )}

      <div className={`mb-8 grid gap-4 ${isAdmin ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-6" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-5"}`}>
        <KpiCard
          label="Campaigns"
          value={String(totals.campaigns)}
          to="/activity"
          icon={<RadioTower className="h-5 w-5" />}
          tone="primary"
        />
        {isAdmin && (
          <KpiCard
            label="Budget"
            value={totalBudget > 0 ? `$${totalBudget.toLocaleString()}` : "$0"}
            hint="Active campaigns"
            to="/activity"
            icon={<PieChart className="h-5 w-5" />}
            tone="teal"
          />
        )}
        <KpiCard
          label="Marketing Spend"
          value={`$${totals.spend.toLocaleString()}`}
          to="/activity"
          icon={<Receipt className="h-5 w-5" />}
          tone="warning"
        />
        <KpiCard
          label="Leads"
          value={String(totals.leads)}
          to="/leads"
          icon={<Target className="h-5 w-5" />}
          tone="purple"
        />
        <KpiCard
          label="Clients"
          value={String(totals.clients)}
          to="/leads"
          icon={<Building2 className="h-5 w-5" />}
          tone="success"
        />
        <KpiCard
          label="Conversion Rate"
          value={`${totals.cvr}%`}
          to="/activity"
          icon={<Gauge className="h-5 w-5" />}
          tone="success"
        />
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Recent activity</h2>
          <a href="/activity" className="text-sm text-primary hover:underline">View all →</a>
        </div>
        <ActivityTable activities={activities} dense hideActions />
      </div>
    </div>
  );
}
