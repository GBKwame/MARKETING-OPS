import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Megaphone, ListTodo, FolderOpen, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Activity", url: "/activity", icon: Megaphone },
  { title: "To Do", url: "/todo", icon: ListTodo },
  { title: "Assets", url: "/assets", icon: FolderOpen },
  { title: "More", url: "/more", icon: MoreHorizontal },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {items.map((i) => {
          const active = pathname === i.url;
          return (
            <li key={i.url}>
              <Link
                to={i.url}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <i.icon className="h-5 w-5" />
                <span>{i.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}