import { Bell, LogOut, Moon, Search, Sun, User, X } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function Topbar() {
  const { theme, toggle } = useTheme();
  const {
    currentUser,
    logout,
    notifications,
    markAllRead,
    markNotificationRead,
    searchQuery,
    setSearchQuery,
  } = useStore();
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.read).length;

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  const isUnprovisionedAdmin =
    currentUser?.role === "admin" &&
    (!currentUser.organizationId || currentUser.organizationId === "org-default" || currentUser.organizationId === "pending-org");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur transition-all">
      {/* Left Section: Sidebar Toggle + Global Search */}
      <div className="flex items-center gap-3">
        {!isUnprovisionedAdmin && (
          <SidebarTrigger className="h-9 w-9 border bg-background hover:bg-muted" />
        )}

        {currentUser?.role !== "super_admin" && !isUnprovisionedAdmin && (
          <div className="relative w-32 sm:w-64 md:w-96">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-full bg-muted/50 pl-8 pr-7 text-xs transition-all focus:bg-background focus:ring-1 focus:ring-primary [&::-webkit-search-cancel-button]:appearance-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right Section: Notifications, Theme, User Avatar */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Notifications Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full border bg-background hover:bg-muted">
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-3 py-2">
              <DropdownMenuLabel className="p-0 text-xs font-semibold">
                Notifications ({unread} unread)
              </DropdownMenuLabel>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] font-bold text-primary hover:bg-primary/10"
                  onClick={async () => {
                    const { subscribeUserToPush, sendTestNotification } = await import("@/lib/push-notifications");
                    const success = await subscribeUserToPush();
                    if (success) {
                      await sendTestNotification();
                      const { toast } = await import("sonner");
                      toast.success("Mobile PWA Push Notifications activated!");
                    } else {
                      const { toast } = await import("sonner");
                      toast.info("Please grant Notification permissions in browser/device settings.");
                    }
                  }}
                >
                  Enable PWA Push
                </Button>
                {unread > 0 && (
                  <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={markAllRead}>
                    Mark all read
                  </Button>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">No notifications yet</div>
            )}
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex flex-col items-start gap-0.5 p-2.5 cursor-pointer hover:bg-muted/60"
                onClick={() => markNotificationRead(n.id)}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className={`text-xs ${!n.read ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}>
                    {n.title}
                  </span>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                </div>
                <span className="text-[11px] text-muted-foreground">{n.body}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label="Toggle theme"
          className="h-9 w-9 rounded-full border bg-background hover:bg-muted"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* User Profile Dropdown */}
        {currentUser ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 rounded-full border bg-background px-2 hover:bg-muted cursor-pointer">
                <Avatar className="h-7 w-7">
                  {currentUser.picture ? (
                    <AvatarImage src={currentUser.picture} alt={currentUser.name} />
                  ) : null}
                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                    {currentUser.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <div className="text-xs font-semibold leading-none">{currentUser.name}</div>
                  <div className="mt-0.5 text-[10px] capitalize text-muted-foreground">
                    {currentUser.role.replace("_", " ")}
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-xs font-semibold">{currentUser.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{currentUser.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center gap-2 text-xs cursor-pointer">
                  <User className="h-3.5 w-3.5" /> View Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-xs text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="mr-2 h-3.5 w-3.5" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild size="sm" className="h-8 rounded-full text-xs">
            <Link to="/login">Sign In</Link>
          </Button>
        )}
      </div>
    </header>
  );
}