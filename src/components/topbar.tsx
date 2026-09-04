import { useState } from "react";
import { Bell, LogOut, Moon, Search, Sun, User, X, Sparkles, BellRing, CheckCheck, Smartphone, Loader2 } from "lucide-react";
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
import { subscribeUserToPush, sendTestNotification } from "@/lib/push-notifications";
import { toast } from "sonner";

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
  const [isEnablingPush, setIsEnablingPush] = useState(false);

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
          <DropdownMenuContent align="end" className="w-[94vw] max-w-[390px] sm:w-96 rounded-2xl p-0 shadow-2xl border border-border/80 bg-card/95 backdrop-blur-xl overflow-hidden mt-1.5 transition-all">
            {/* Premium Header */}
            <div className="relative border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative grid h-8 w-8 place-items-center rounded-xl bg-primary/15 text-primary">
                  <BellRing className="h-4 w-4" />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background animate-pulse" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>Notifications</span>
                    {unread > 0 ? (
                      <Badge variant="default" className="h-4 px-1.5 text-[9px] font-black rounded-full bg-primary text-primary-foreground">
                        {unread} NEW
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-semibold text-muted-foreground border-border">
                        All Read
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Real-time workspace activity updates</p>
                </div>
              </div>

              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] font-bold text-muted-foreground hover:text-foreground gap-1 px-2 rounded-lg cursor-pointer"
                  onClick={markAllRead}
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Read All
                </Button>
              )}
            </div>

            {/* PWA Mobile Push Bar (Hidden on desktop/laptop screens) */}
            <div className="sm:hidden bg-muted/40 px-3.5 py-2 border-b flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Mobile OS Push Alerts</span>
              </div>
              <Button
                size="sm"
                disabled={isEnablingPush}
                className="h-6 px-2 text-[10px] font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs gap-1 cursor-pointer disabled:opacity-70"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isEnablingPush) return;
                  setIsEnablingPush(true);
                  try {
                    const success = await subscribeUserToPush();
                    if (success) {
                      await sendTestNotification();
                      toast.success("Mobile PWA Push Notifications activated!");
                    } else {
                      toast.info("Please allow Notification permissions in browser settings.");
                    }
                  } catch (err: any) {
                    toast.error("Failed to enable push notifications.");
                  } finally {
                    setIsEnablingPush(false);
                  }
                }}
              >
                {isEnablingPush ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    <span>Enabling...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" />
                    <span>Enable Push</span>
                  </>
                )}
              </Button>
            </div>

            {/* Notification List Container */}
            <div className="max-h-[60vh] sm:max-h-[380px] overflow-y-auto p-1.5 space-y-1">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-muted/60 grid place-items-center text-muted-foreground/60">
                    <Bell className="h-5 w-5" />
                  </div>
                  <p className="font-semibold text-foreground">No notifications yet</p>
                  <p className="text-[10px] max-w-[200px] text-muted-foreground">Activities, leads & approvals will trigger instant alerts here.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl cursor-pointer transition-all ${
                      !n.read
                        ? "bg-primary/5 border-l-2 border-l-primary font-medium shadow-2xs"
                        : "hover:bg-muted/50 text-muted-foreground opacity-85"
                    }`}
                    onClick={() => markNotificationRead(n.id)}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className={`text-xs ${!n.read ? "font-bold text-foreground" : "font-semibold text-muted-foreground"}`}>
                        {n.title}
                      </span>
                      {!n.read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0 ring-2 ring-primary/20 animate-pulse" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{n.body}</p>
                  </DropdownMenuItem>
                ))
              )}
            </div>
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