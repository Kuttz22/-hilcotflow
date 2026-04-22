import DashboardLayout from "@/components/DashboardLayout";
import { TaskCard } from "@/components/TaskCard";
import { TaskFormModal } from "@/components/TaskFormModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ACTION_LABELS, formatRelativeTime } from "@/lib/taskUtils";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Plus,
  Share2,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Dashboard() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading } = trpc.dashboard.summary.useQuery();
  const { data: recentActivity, isLoading: activityLoading } = trpc.dashboard.recentActivity.useQuery({ limit: 8 });
  const { data: criticalTasks, isLoading: tasksLoading } = trpc.tasks.list.useQuery({
    priority: "critical",
    status: "pending",
  });
  const { data: overdueTasks } = trpc.tasks.list.useQuery({ status: "overdue" });
  const { data: escalatedTasks } = trpc.tasks.list.useQuery({ status: "escalated" });

  const utils = trpc.useUtils();

  const summaryCards = [
    {
      title: "Active Tasks",
      value: summary?.totalActive ?? 0,
      icon: ClipboardList,
      color: "text-primary",
      bg: "bg-accent",
      path: "/tasks",
    },
    {
      title: "Assigned To Me",
      value: summary?.assignedToMe ?? 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
      path: "/tasks/assigned-to-me",
    },
    {
      title: "Assigned By Me",
      value: summary?.assignedByMe ?? 0,
      icon: TrendingUp,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      path: "/tasks/assigned-by-me",
    },
    {
      title: "Shared With Me",
      value: summary?.sharedWithMe ?? 0,
      icon: Share2,
      color: "text-violet-600",
      bg: "bg-violet-50",
      path: "/tasks/shared-with-me",
    },
    {
      title: "Waiting on Others",
      value: summary?.waitingOnOthers ?? 0,
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-50",
      path: "/tasks/waiting-on-others",
    },
    {
      title: "Overdue",
      value: summary?.overdue ?? 0,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
      path: "/tasks/overdue",
    },
    {
      title: "Escalated",
      value: summary?.escalated ?? 0,
      icon: Zap,
      color: "text-rose-600",
      bg: "bg-rose-50",
      path: "/tasks/escalated",
    },
    {
      title: "Completed Today",
      value: summary?.completedToday ?? 0,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      path: "/tasks",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Good {getGreeting()}, {user?.name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {summaryCards.map(({ title, value, icon: Icon, color, bg, path }) => (
          <Card
            key={title}
            className={`cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border border-border ${
              title === "Escalated" && (value ?? 0) > 0 ? "border-rose-200 bg-rose-50/30" : ""
            }`}
            onClick={() => navigate(path)}
          >
            <CardContent className="p-3">
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
              {summaryLoading ? (
                <Skeleton className="h-6 w-8 mb-1" />
              ) : (
                <div className={`text-xl font-bold ${title === "Escalated" && (value ?? 0) > 0 ? "text-rose-600" : "text-foreground"}`}>
                  {value}
                </div>
              )}
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{title}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main task panels */}
        <div className="lg:col-span-2 space-y-4">

          {/* Escalated Tasks — shown first when present */}
          {(escalatedTasks?.length ?? 0) > 0 && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-rose-500" />
                  Escalated Tasks
                  <span className="text-xs font-normal text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                    Requires immediate attention
                  </span>
                </h2>
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/tasks/escalated")}>
                  View all <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
              <div className="space-y-2">
                {escalatedTasks?.slice(0, 3).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentUserId={user?.id ?? 0}
                    onRefresh={() => utils.tasks.list.invalidate()}
                    compact
                  />
                ))}
              </div>
            </>
          )}

          {/* Critical Tasks */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Critical Tasks
            </h2>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/tasks")}>
              View all <ArrowRight className="w-3 h-3" />
            </Button>
          </div>

          {tasksLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          ) : criticalTasks?.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">No critical tasks</p>
                <p className="text-xs text-muted-foreground mt-1">All critical tasks are completed</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {criticalTasks?.slice(0, 5).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  currentUserId={user?.id ?? 0}
                  onRefresh={() => utils.tasks.list.invalidate()}
                  compact
                />
              ))}
            </div>
          )}

          {/* Overdue Tasks */}
          {(overdueTasks?.length ?? 0) > 0 && (
            <>
              <div className="flex items-center justify-between mt-2">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Overdue Tasks
                </h2>
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/tasks/overdue")}>
                  View all <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
              <div className="space-y-2">
                {overdueTasks?.slice(0, 3).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentUserId={user?.id ?? 0}
                    onRefresh={() => utils.tasks.list.invalidate()}
                    compact
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Activity Feed */}
        <div>
          <Card className="border border-border">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activityLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : recentActivity?.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-xs text-muted-foreground">No activity yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentActivity?.map((entry) => (
                    <div key={entry.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[9px] font-medium text-accent-foreground">
                            {(entry.userName ?? "?")[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground leading-snug">
                            <span className="font-medium">{entry.userName ?? "Someone"}</span>
                            {" "}{ACTION_LABELS[entry.action] ?? entry.action}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {entry.taskTitle}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {formatRelativeTime(entry.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Hilcot TaskFlow</span>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
        </div>
      </div>

      <TaskFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => utils.tasks.list.invalidate()}
      />
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
