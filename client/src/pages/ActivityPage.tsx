import DashboardLayout from "@/components/DashboardLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ACTION_LABELS, formatRelativeTime, getInitials } from "@/lib/taskUtils";
import { trpc } from "@/lib/trpc";
import { Activity } from "lucide-react";
import { useLocation } from "wouter";

export default function ActivityPage() {
  return (
    <DashboardLayout>
      <ActivityContent />
    </DashboardLayout>
  );
}

function ActivityContent() {
  const [, navigate] = useLocation();
  const { data: activity, isLoading } = trpc.dashboard.recentActivity.useQuery({ limit: 50 });

  const actionColors: Record<string, string> = {
    created: "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700",
    assigned: "bg-violet-100 text-violet-700",
    shared: "bg-indigo-100 text-indigo-700",
    unshared: "bg-slate-100 text-slate-600",
    status_changed: "bg-amber-100 text-amber-700",
    updated: "bg-slate-100 text-slate-600",
    reopened: "bg-orange-100 text-orange-700",
    reminder_sent: "bg-yellow-100 text-yellow-700",
    priority_changed: "bg-red-100 text-red-700",
    due_date_changed: "bg-cyan-100 text-cyan-700",
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          All task activity across your workspace
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity?.length === 0 ? (
            <div className="p-10 text-center">
              <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No activity recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activity?.map((entry) => (
                <div
                  key={entry.id}
                  className="px-5 py-4 flex items-start gap-3.5 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => navigate(`/tasks/${entry.taskId}`)}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs bg-accent text-accent-foreground">
                      {getInitials(entry.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{entry.userName ?? "System"}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColors[entry.action] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      Task: <span className="font-medium text-foreground">{entry.taskTitle}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                      {new Date(entry.createdAt).toLocaleString()} · {formatRelativeTime(entry.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
