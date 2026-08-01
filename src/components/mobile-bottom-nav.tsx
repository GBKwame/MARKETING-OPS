import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  Activity,
  Target,
  FolderKanban,
  Users,
  CheckSquare,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { currentUser } = useStore();

  const isMarketer = currentUser?.role === "marketer";

  const navItems = [
    { title: "Dashboard", url: "/", icon: LayoutGrid },
    { title: "Activity", url: "/activity", icon: Activity },
    { title: "Leads", url: "/leads", icon: Target },
    { title: "Assets", url: "/assets", icon: FolderKanban },
    ...(isMarketer
      ? [{ title: "To Do", url: "/todo", icon: CheckSquare }]
      : [{ title: "Team", url: "/team", icon: Users }]),
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 backdrop-blur-lg md:hidden pb-[env(safe-area-inset-bottom)] shadow-2xl">
      <ul className="grid h-14 grid-cols-5 items-center px-1">
        {navItems.map((item) => {
          const isActive = pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url));
          const Icon = item.icon;

          return (
            <li key={item.url} className="flex justify-center">
              <Link
                to={item.url}
                className={cn(
                  "relative flex flex-col items-center justify-center w-full py-1 gap-0.5 text-[10px] font-semibold transition-all duration-200 cursor-pointer select-none",
                  isActive
                    ? "text-primary scale-105 font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute -top-1.5 h-1 w-6 rounded-full bg-primary shadow-[0_0_8px_rgba(124,92,255,0.8)]" />
                )}
                <Icon className={cn("h-5 w-5 transition-transform duration-200", isActive && "stroke-[2.4]")} />
                <span className="truncate max-w-[56px] text-center leading-tight">{item.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}