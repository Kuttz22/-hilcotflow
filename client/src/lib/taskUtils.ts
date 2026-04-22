export type Priority = "normal" | "priority" | "critical";
export type TaskStatus = "pending" | "in_progress" | "completed" | "overdue" | "escalated";
export type CompletionPermission = "creator_only" | "assignee_only" | "any_participant";

export const PRIORITY_CONFIG: Record<Priority, { label: string; badgeClass: string; dotClass: string; borderClass: string; ringClass: string }> = {
  normal: {
    label: "Normal",
    badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
    dotClass: "bg-slate-400",
    borderClass: "border-l-slate-300",
    ringClass: "",
  },
  priority: {
    label: "Priority",
    badgeClass: "bg-amber-50 text-amber-800 border border-amber-300 font-semibold",
    dotClass: "bg-amber-500",
    borderClass: "border-l-amber-500",
    ringClass: "ring-1 ring-amber-200",
  },
  critical: {
    label: "Critical",
    badgeClass: "bg-red-600 text-white border border-red-700 font-bold",
    dotClass: "bg-red-600",
    borderClass: "border-l-red-600",
    ringClass: "ring-2 ring-red-300",
  },
};

export const STATUS_CONFIG: Record<TaskStatus, { label: string; badgeClass: string }> = {
  pending: { label: "Pending", badgeClass: "bg-slate-100 text-slate-600" },
  in_progress: { label: "In Progress", badgeClass: "bg-blue-50 text-blue-700 border border-blue-200" },
  completed: { label: "Completed", badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  overdue: { label: "Overdue", badgeClass: "bg-red-50 text-red-700 border border-red-200 font-semibold" },
  escalated: { label: "Escalated", badgeClass: "bg-orange-600 text-white border border-orange-700 font-bold" },
};

export const COMPLETION_PERMISSION_LABELS: Record<CompletionPermission, string> = {
  creator_only: "Creator only",
  assignee_only: "Assignee only",
  any_participant: "Any participant",
};

export const ACTION_LABELS: Record<string, string> = {
  created: "Created task",
  updated: "Updated task",
  assigned: "Assigned task",
  shared: "Shared task",
  unshared: "Removed share",
  status_changed: "Changed status",
  completed: "Completed task",
  reopened: "Reopened task",
  reminder_sent: "Reminder sent",
  priority_changed: "Changed priority",
  due_date_changed: "Changed due date",
  escalated: "Task escalated",
  escalation_alert: "Escalation alert sent",
};

export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function isOverdue(dueDate: Date | string | null | undefined, status: TaskStatus): boolean {
  if (!dueDate || status === "completed") return false;
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  return d < new Date();
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
