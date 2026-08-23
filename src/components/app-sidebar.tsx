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
          {/* Custom Zexpand Logo */}
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-amber-500/30 bg-black shadow-sm">
            <img src="/logo.jpg" alt="Zexpand Logo" className="h-full w-full object-cover" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-black tracking-wider text-foreground">ZEXPAND</div>
              <div className="truncate text-[10px] font-semibold text-muted-foreground">
                {currentUser?.organizationName || WORKSPACE}
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold px-2 py-1.5">
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
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                          isActive
                            ? "bg-sky-500/10 text-sky-600 dark:bg-[#18294a] dark:text-sky-400 font-bold shadow-xs border border-sky-500/20"
                            : "text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-sky-600 dark:text-sky-400" : "text-slate-500 dark:text-slate-400"}`} />
                        {!collapsed && <span className={isActive ? "text-sky-600 dark:text-sky-400" : "text-slate-800 dark:text-slate-200"}>{item.title}</span>}
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