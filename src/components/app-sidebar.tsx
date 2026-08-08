import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  Activity,
  CheckSquare,
  ShieldCheck,
  FolderKanban,
  Share2,
  Target,
  Users,
  Sliders,
  User,
  Building2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { WORKSPACE } from "@/lib/mock-data";

import { useStore } from "@/lib/store";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutGrid },
  { title: "Marketing Activity", url: "/activity", icon: Activity },
  { title: "To Do", url: "/todo", icon: CheckSquare },
  { title: "Approvals", url: "/approvals", icon: ShieldCheck },
  { title: "Assets", url: "/assets", icon: FolderKanban },
  { title: "Company Links", url: "/company-links", icon: Share2 },
  { title: "Leads", url: "/leads", icon: Target },
  { title: "Team", url: "/team", icon: Users },
  { title: "Settings", url: "/settings", icon: Sliders },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { currentUser } = useStore();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isMarketer = currentUser?.role === "marketer";
  const isSuperAdmin = currentUser?.role === "super_admin";

  const visibleItems = isSuperAdmin
    ? [{ title: "SaaS Admin Portal", url: "/super-admin", icon: Building2 }]
    : isMarketer
    ? items.filter((i) => i.url !== "/settings" && i.url !== "/team")
    : items;

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarHeader className="border-b border-border/60">
        <Link to={isSuperAdmin ? "/super-admin" : "/"} className="flex items-center gap-2.5 px-2 py-2">
          {/* Custom MarketOps Geometric Pulse Logo SVG */}
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight">MarketOps</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {currentUser?.organizationName || WORKSPACE}
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold px-2">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link
                        to={item.url}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        }`}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}