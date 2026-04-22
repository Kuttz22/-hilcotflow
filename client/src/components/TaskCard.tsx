import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PRIORITY_CONFIG, STATUS_CONFIG, formatDate, getInitials } from "@/lib/taskUtils";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "./ui/avatar";

type Task = {
  id: number;
  title: string;
  description: string | null;
  priority: "normal" | "priority" | "critical";
  status: "pending" | "in_progress" | "completed" | "overdue" | "escalated";
  dueDate: Date | null;
  createdById: number;
  assignedToId: number | null;
  completedById: number | null;
  completedAt: Date | null;
  createdByName?: string | null;
  assignedToName?: string | null;
  reminderEnabled: boolean;
  createdAt: Date;
};

interface TaskCardProps {
  task: Task;
  currentUserId: number;
  onEdit?: (task: Task) => void;
  onRefresh?: () => void;
  compact?: boolean;
}

export function TaskCard({ task, currentUserId, onEdit, onRefresh, compact = false }: TaskCardProps) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const completeMutation = trpc.tasks.complete.useMutation({
    onSuccess: () => {
      toast.success("Task marked as completed");
      utils.tasks.list.invalidate();
      utils.dashboard.summary.invalidate();
      onRefresh?.();
    },
    onError: () => toast.error("Failed to complete task"),
  });

  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      toast.success("Task deleted");
      utils.tasks.list.invalidate();
      utils.dashboard.summary.invalidate();
      onRefresh?.();
    },
    onError: () => toast.error("Failed to delete task"),
  });

  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const statusCfg = STATUS_CONFIG[task.status];
  const isCompleted = task.status === "completed";
  const isOverdue = task.status === "overdue";
  const canComplete = !isCompleted;
  const canDelete = task.createdById === currentUserId;

  return (
    <Card
      className={`group border border-border bg-card hover:shadow-md transition-all duration-200 cursor-pointer border-l-4 ${priorityCfg.borderClass} ${isCompleted ? "opacity-60" : ""}`}
      onClick={() => navigate(`/tasks/${task.id}`)}
    >
      <div className={`p-4 ${compact ? "py-3" : ""}`}>
        <div className="flex items-start gap-3">
          {/* Priority dot */}
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${priorityCfg.dotClass}`} />

          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start justify-between gap-2">
              <h3 className={`font-medium text-sm leading-snug ${isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {task.title}
              </h3>
              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                {task.reminderEnabled && !isCompleted && (
                  <span title="Reminders active">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                  </span>
                )}
                {isOverdue && (
                  <span title="Overdue">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => navigate(`/tasks/${task.id}`)}>
                      View Details
                    </DropdownMenuItem>
                    {onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(task)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </DropdownMenuItem>
                    )}
                    {canComplete && (
                      <DropdownMenuItem
                        onClick={() => completeMutation.mutate({ id: task.id })}
                        disabled={completeMutation.isPending}
                      >
                        <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-600" />
                        Mark Complete
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => deleteMutation.mutate({ id: task.id })}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Description */}
            {!compact && task.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <Badge variant="outline" className={`text-xs px-2 py-0.5 font-normal ${priorityCfg.badgeClass}`}>
                {priorityCfg.label}
              </Badge>
              <Badge variant="outline" className={`text-xs px-2 py-0.5 font-normal ${statusCfg.badgeClass}`}>
                {statusCfg.label}
              </Badge>

              {task.dueDate && (
                <span className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                  <Calendar className="w-3 h-3" />
                  {formatDate(task.dueDate)}
                </span>
              )}

              {task.assignedToName && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                  <Avatar className="h-4 w-4">
                    <AvatarFallback className="text-[8px] bg-accent text-accent-foreground">
                      {getInitials(task.assignedToName)}
                    </AvatarFallback>
                  </Avatar>
                  {task.assignedToName}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
