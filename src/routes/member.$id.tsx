import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ActivityTable } from "@/components/activity-table";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/member/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Member — Zexpand` },
      { name: "description", content: `Full marketing activity for member ${params.id}.` },
      { property: "og:title", content: "Team member activity" },
      { property: "og:description", content: "Every activity by this team member." },
    ],
  }),
  component: MemberPage,
});

function MemberPage() {
  const { id } = Route.useParams();
  const { memberById, activities } = useStore();
  const member = memberById(id);
  const rows = useMemo(() => activities.filter((a) => a.memberId === id), [activities, id]);
  const leads = rows.reduce((s, r) => s + r.leads, 0);
  const clients = rows.reduce((s, r) => s + r.clients, 0);

  if (!member) return <div className="p-8">Member not found.</div>;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title={member.name}
        description={`${member.branch} · ${rows.length} activities · ${leads} leads · ${clients} clients`}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="capitalize">{member.role}</Badge>
            <Avatar className="h-10 w-10"><AvatarFallback>{member.avatar}</AvatarFallback></Avatar>
          </div>
        }
      />
      <ActivityTable activities={rows} />
    </div>
  );
}