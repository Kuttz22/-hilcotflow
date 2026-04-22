import DashboardLayout from "@/components/DashboardLayout";
import { TaskCard } from "@/components/TaskCard";
import { TaskFormModal } from "@/components/TaskFormModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Plus, Search, Filter, X, RefreshCw } from "lucide-react";
import { useState, useMemo } from "react";

type View = "my_tasks" | "assigned_to_me" | "assigned_by_me" | "shared_with_me" | "waiting_on_others" | "all";
type StatusFilter = "pending" | "in_progress" | "completed" | "overdue" | "escalated" | undefined;

const VIEW_TITLES: Record<View, string> = {
  my_tasks: "My Tasks",
  assigned_to_me: "Assigned To Me",
  assigned_by_me: "Assigned By Me",
  shared_with_me: "Shared With Me",
  waiting_on_others: "Waiting on Others",
  all: "All Tasks",
};

interface TasksPageProps {
  view?: View;
  statusFilter?: StatusFilter;
}

export default function TasksPage({ view = "all", statusFilter }: TasksPageProps) {
  return (
    <DashboardLayout>
      <TasksContent view={view} initialStatusFilter={statusFilter} />
    </DashboardLayout>
  );
}

function TasksContent({ view, initialStatusFilter }: { view: View; initialStatusFilter?: StatusFilter }) {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Parameters<typeof TaskFormModal>[0]["editTask"]>(null);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter ?? "all");
  const [dueDateFrom, setDueDateFrom] = useState("");
  const [dueDateTo, setDueDateTo] = useState("");

  const utils = trpc.useUtils();

  const queryInput = useMemo(() => ({
    view,
    priority: priorityFilter !== "all" ? priorityFilter as "normal" | "priority" | "critical" : undefined,
    status: statusFilter !== "all" ? statusFilter as "pending" | "in_progress" | "completed" | "overdue" | "escalated" : undefined,
    search: search || undefined,
    dueDateFrom: dueDateFrom ? new Date(dueDateFrom) : undefined,
    dueDateTo: dueDateTo ? new Date(dueDateTo) : undefined,
  }), [view, priorityFilter, statusFilter, search, dueDateFrom, dueDateTo]);

  const { data: tasks, isLoading, refetch } = trpc.tasks.list.useQuery(queryInput);

  const hasFilters = priorityFilter !== "all" || statusFilter !== "all" || search || dueDateFrom || dueDateTo;

  const clearFilters = () => {
    setPriorityFilter("all");
    setStatusFilter("all");
    setSearch("");
    setDueDateFrom("");
    setDueDateTo("");
  };

  const title = VIEW_TITLES[view];

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? "Loading..." : `${tasks?.length ?? 0} task${tasks?.length !== 1 ? "s" : ""}`}
            {view === "all" && <span className="ml-1 text-xs">(tasks you created, are assigned to, or shared with)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Priority filter */}
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
          </SelectContent>
        </Select>

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={dueDateFrom}
            onChange={(e) => setDueDateFrom(e.target.value)}
            className="h-9 w-36 text-sm"
            placeholder="From"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={dueDateTo}
            onChange={(e) => setDueDateTo(e.target.value)}
            className="h-9 w-36 text-sm"
            placeholder="To"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground h-9">
            <X className="w-3.5 h-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Active filter badges */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {priorityFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Priority: {priorityFilter}
              <button onClick={() => setPriorityFilter("all")}><X className="w-3 h-3" /></button>
            </Badge>
          )}
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Status: {statusFilter.replace("_", " ")}
              <button onClick={() => setStatusFilter("all")}><X className="w-3 h-3" /></button>
            </Badge>
          )}
          {search && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Search: "{search}"
              <button onClick={() => setSearch("")}><X className="w-3 h-3" /></button>
            </Badge>
          )}
        </div>
      )}

      {/* Task List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : tasks?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Filter className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-base font-medium text-foreground">No tasks found</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {hasFilters ? "Try adjusting your filters" : "Create your first task to get started"}
          </p>
          {!hasFilters && (
            <Button onClick={() => setCreateOpen(true)} className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              Create Task
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {tasks?.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              currentUserId={user?.id ?? 0}
              onEdit={(t) => setEditTask({
                id: t.id,
                title: t.title,
                description: t.description,
                priority: t.priority,
                status: t.status,
                dueDate: t.dueDate,
                assignedToId: t.assignedToId,
                reminderEnabled: t.reminderEnabled,
                reminderIntervalMinutes: null,
                reminderRecipients: null,
              })}
              onRefresh={() => utils.tasks.list.invalidate()}
            />
          ))}
        </div>
      )}

      <TaskFormModal
        open={createOpen || !!editTask}
        onClose={() => { setCreateOpen(false); setEditTask(null); }}
        editTask={editTask}
        onSuccess={() => utils.tasks.list.invalidate()}
      />
    </div>
  );
}
