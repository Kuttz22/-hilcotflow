import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Clock,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Settings,
  Share2,
  Users,
  BookUser,
  Zap,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { trpc } from "@/lib/trpc";
import { getInitials } from "@/lib/taskUtils";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-2">
            <CheckSquare className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in to continue</h1>
            <p className="text-sm text-muted-foreground max-w-sm">
              Access to Hilcot TaskFlow requires authentication.
            </p>
          </div>
          <Button onClick={() => { window.location.href = "/login"; }} size="lg" className="w-full gap-2">
            Sign In
          </Button>
          <p className="text-xs text-muted-foreground">
            New here?{" "}
            <a href="/login" className="underline hover:text-foreground transition-colors">
              Create an account
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Fetch dashboard summary for badge counts
  const { data: summary } = trpc.dashboard.summary.useQuery(undefined, {
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const navMain = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: ClipboardList, label: "All Tasks", path: "/tasks", badge: summary?.totalActive },
  ];

  const navTasks = [
    { icon: CheckSquare, label: "Assigned To Me", path: "/tasks/assigned-to-me", badge: summary?.assignedToMe },
    { icon: ArrowUpRight, label: "Assigned By Me", path: "/tasks/assigned-by-me", badge: summary?.assignedByMe },
    { icon: Share2, label: "Shared With Me", path: "/tasks/shared-with-me", badge: summary?.sharedWithMe },
    { icon: Clock, label: "Waiting on Others", path: "/tasks/waiting-on-others", badge: summary?.waitingOnOthers },
    { icon: AlertTriangle, label: "Overdue", path: "/tasks/overdue", badge: summary?.overdue, badgeVariant: "destructive" as const },
    { icon: Zap, label: "Escalated", path: "/tasks/escalated", badge: summary?.escalated, badgeVariant: "destructive" as const },
  ];

  const navSystem = [
    { icon: Activity, label: "Activity Log", path: "/activity" },
    { icon: BookUser, label: "Directory", path: "/directory" },
    { icon: Users, label: "Team", path: "/team" },
    { icon: Bell, label: "Notifications", path: "/settings/notifications" },
  ];

  const isActive = (path: string) => location === path || (path !== "/dashboard" && location.startsWith(path));

  const NavItem = ({ icon: Icon, label, path, badge, badgeVariant = "secondary" as const }: {
    icon: typeof LayoutDashboard;
    label: string;
    path: string;
    badge?: number;
    badgeVariant?: "secondary" | "destructive";
  }) => {
    const active = isActive(path);
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={active}
          onClick={() => setLocation(path)}
          tooltip={label}
          className="h-9 gap-3 font-normal"
        >
          <Icon className={`h-4 w-4 shrink-0 ${active ? "text-sidebar-primary" : "text-sidebar-foreground/60"}`} />
          <span className="flex-1 truncate">{label}</span>
          {badge !== undefined && badge > 0 && !isCollapsed && (
            <Badge variant={badgeVariant} className="ml-auto text-xs h-5 px-1.5 min-w-[20px] justify-center">
              {badge > 99 ? "99+" : badge}
            </Badge>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const pageTitles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/tasks": "All Tasks",
    "/tasks/assigned-to-me": "Assigned To Me",
    "/tasks/assigned-by-me": "Assigned By Me",
    "/tasks/shared-with-me": "Shared With Me",
    "/tasks/waiting-on-others": "Waiting on Others",
    "/tasks/overdue": "Overdue Tasks",
    "/tasks/escalated": "Escalated Tasks",
    "/activity": "Activity Log",
    "/team": "Team",
    "/settings/notifications": "Notification Preferences",
  };
  const pageTitle = pageTitles[location] ?? "TaskFlow";

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-sidebar-border" disableTransition={isResizing}>
          {/* Header */}
          <SidebarHeader className="h-16 border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-3 h-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-sidebar-primary flex items-center justify-center shrink-0">
                    <CheckSquare className="w-3.5 h-3.5 text-sidebar-primary-foreground" />
                  </div>
                  <span className="font-semibold text-sm text-sidebar-foreground tracking-tight truncate">
                    Hilcot TaskFlow
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* Content */}
          <SidebarContent className="py-3">
            {/* Main nav */}
            <SidebarGroup className="px-2 pb-1">
              <SidebarMenu>
                {navMain.map((item) => <NavItem key={item.path} {...item} />)}
              </SidebarMenu>
            </SidebarGroup>

            {/* Tasks group */}
            <SidebarGroup className="px-2 pb-1">
              {!isCollapsed && (
                <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider px-2 mb-1">
                  My Work
                </SidebarGroupLabel>
              )}
              <SidebarMenu>
                {navTasks.map((item) => <NavItem key={item.path} {...item} />)}
              </SidebarMenu>
            </SidebarGroup>

            {/* System group */}
            <SidebarGroup className="px-2">
              {!isCollapsed && (
                <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider px-2 mb-1">
                  System
                </SidebarGroupLabel>
              )}
              <SidebarMenu>
                {navSystem.map((item) => <NavItem key={item.path} {...item} />)}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-3 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors w-full text-left focus:outline-none">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-sidebar-primary text-sidebar-primary-foreground">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-sidebar-foreground truncate leading-none">{user?.name || "User"}</p>
                        <p className="text-xs text-sidebar-foreground/50 truncate mt-1">{user?.email || ""}</p>
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/40 shrink-0" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation("/settings/notifications")} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Preferences
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await logout();
                    window.location.href = "/login";
                  }}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {/* Mobile header */}
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <span className="font-semibold text-sm">{pageTitle}</span>
            </div>
          </div>
        )}
        <main className="flex-1 min-h-screen">{children}</main>
      </SidebarInset>
    </>
  );
}
