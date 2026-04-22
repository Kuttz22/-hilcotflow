import DashboardLayout from "@/components/DashboardLayout";
import { TaskFormModal } from "@/components/TaskFormModal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTION_LABELS,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  formatDate,
  formatRelativeTime,
  getInitials,
} from "@/lib/taskUtils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  Pencil,
  Send,
  Share2,
  Trash2,
  User,
  Users,
  Check,
  X,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function TaskDetailPage() {
  return (
    <DashboardLayout>
      <TaskDetailContent />
    </DashboardLayout>
  );
}

function TaskDetailContent() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const utils = trpc.useUtils();

  const taskId = parseInt(params.id ?? "0");

  const { data: task, isLoading, error } = trpc.tasks.getById.useQuery(
    { id: taskId },
    { enabled: !!taskId }
  );

  const completeMutation = trpc.tasks.complete.useMutation({
    onSuccess: () => {
      toast.success("Task marked as completed");
      utils.tasks.getById.invalidate({ id: taskId });
      utils.dashboard.summary.invalidate();
    },
    onError: () => toast.error("Failed to complete task"),
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-20">
          <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Task not found</p>
          <p className="text-sm text-muted-foreground mt-1">
            This task may have been deleted or you don't have access.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/tasks")}>
            Back to Tasks
          </Button>
        </div>
      </div>
    );
  }

  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const statusCfg = STATUS_CONFIG[task.status];
  const isCompleted = task.status === "completed";
  const canComplete =
    !isCompleted &&
    (task.createdById === user?.id ||
      task.assignedToId === user?.id ||
      task.shares?.some((s) => s.userId === user?.id));
  const canEdit = task.createdById === user?.id;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 mt-0.5"
            onClick={() => navigate("/tasks")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2.5 h-2.5 rounded-full ${priorityCfg.dotClass}`} />
              <Badge variant="outline" className={`text-xs ${priorityCfg.badgeClass}`}>
                {priorityCfg.label}
              </Badge>
              <Badge variant="outline" className={`text-xs ${statusCfg.badgeClass}`}>
                {statusCfg.label}
              </Badge>
            </div>
            <h1
              className={`text-xl font-bold text-foreground ${
                isCompleted ? "line-through text-muted-foreground" : ""
              }`}
            >
              {task.title}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canComplete && (
            <Button
              onClick={() => completeMutation.mutate({ id: task.id })}
              disabled={completeMutation.isPending}
              className="gap-2"
              variant={isCompleted ? "outline" : "default"}
            >
              <CheckCircle2 className="w-4 h-4" />
              {completeMutation.isPending ? "Completing..." : "Mark Complete"}
            </Button>
          )}
          {canEdit && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Description */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Description</h3>
              {task.description ? (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description provided.</p>
              )}
            </CardContent>
          </Card>

          {/* Comments Thread */}
          <CommentsSection
            taskId={taskId}
            currentUserId={user?.id}
            currentUserRole={user?.role}
            currentUserName={user?.name}
          />

          {/* Activity Log */}
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                Activity History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {task.activity?.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No activity recorded.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {task.activity?.map((entry) => (
                    <div key={entry.id} className="px-5 py-3.5 flex items-start gap-3">
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        <AvatarFallback className="text-[10px] bg-accent text-accent-foreground">
                          {getInitials(entry.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground">
                          <span className="font-medium">{entry.userName ?? "System"}</span>{" "}
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatRelativeTime(entry.createdAt)} ·{" "}
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar details */}
        <div className="space-y-4">
          {/* Task Details */}
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold">Task Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              <DetailRow icon={User} label="Created By" value={task.createdByName ?? "—"} />
              <DetailRow icon={Calendar} label="Created" value={formatDate(task.createdAt)} />
              {task.dueDate && (
                <DetailRow
                  icon={Calendar}
                  label="Due Date"
                  value={formatDate(task.dueDate)}
                  valueClass={task.status === "overdue" ? "text-red-600 font-medium" : ""}
                />
              )}
              {task.assignedToName && (
                <DetailRow icon={Users} label="Assigned To" value={task.assignedToName} />
              )}
              {isCompleted && task.completedAt && (
                <>
                  <Separator />
                  <DetailRow
                    icon={CheckCircle2}
                    label="Completed By"
                    value={task.completedById ? `User #${task.completedById}` : "—"}
                    valueClass="text-emerald-700"
                  />
                  <DetailRow
                    icon={Clock}
                    label="Completed At"
                    value={new Date(task.completedAt).toLocaleString()}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Shared With */}
          {(task.shares?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Share2 className="w-3.5 h-3.5" />
                  Shared With
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2.5">
                {task.shares?.map((share) => (
                  <div key={share.id} className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px] bg-accent text-accent-foreground">
                        {getInitials(share.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {share.userName ?? "User"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {share.userEmail ?? ""}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Reminder Settings */}
          {task.reminderEnabled && !isCompleted && (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader className="pb-3 border-b border-amber-200">
                <CardTitle className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-amber-600" />
                  Active Reminders
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <p className="text-xs text-amber-800">Reminders are active for this task.</p>
                {task.lastReminderSentAt && (
                  <p className="text-xs text-amber-700">
                    Last sent: {formatRelativeTime(task.lastReminderSentAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <TaskFormModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          editTask={{
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            dueDate: task.dueDate,
            assignedToId: task.assignedToId,
            reminderEnabled: task.reminderEnabled,
            reminderIntervalMinutes: task.reminderIntervalMinutes ?? null,
            reminderRecipients: task.reminderRecipients ?? null,
          }}
          onSuccess={() => utils.tasks.getById.invalidate({ id: task.id })}
        />
      )}
    </div>
  );
}

// ─── Comments Section ─────────────────────────────────────────────────────────

function CommentsSection({
  taskId,
  currentUserId,
  currentUserRole,
  currentUserName,
}: {
  taskId: number;
  currentUserId?: number;
  currentUserRole?: string;
  currentUserName?: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: comments = [], isLoading } = trpc.comments.list.useQuery(
    { taskId },
    { enabled: !!taskId, refetchInterval: 15000 }
  );

  const addComment = trpc.comments.add.useMutation({
    onMutate: async (vars) => {
      // Optimistic update
      await utils.comments.list.cancel({ taskId });
      const prev = utils.comments.list.getData({ taskId });
      utils.comments.list.setData({ taskId }, (old) => [
        ...(old ?? []),
        {
          id: -Date.now(),
          taskId,
          userId: currentUserId ?? 0,
          content: vars.content,
          createdAt: new Date(),
          updatedAt: new Date(),
          userName: currentUserName ?? null,
          userEmail: null,
        },
      ]);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      utils.comments.list.setData({ taskId }, ctx?.prev);
      toast.error("Failed to post comment.");
    },
    onSettled: () => {
      utils.comments.list.invalidate({ taskId });
    },
    onSuccess: () => {
      setDraft("");
    },
  });

  const updateComment = trpc.comments.update.useMutation({
    onMutate: async (vars) => {
      await utils.comments.list.cancel({ taskId });
      const prev = utils.comments.list.getData({ taskId });
      utils.comments.list.setData({ taskId }, (old) =>
        (old ?? []).map((c) =>
          c.id === vars.commentId ? { ...c, content: vars.content, updatedAt: new Date() } : c
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      utils.comments.list.setData({ taskId }, ctx?.prev);
      toast.error("Failed to update comment.");
    },
    onSettled: () => {
      utils.comments.list.invalidate({ taskId });
    },
    onSuccess: () => {
      setEditingId(null);
      setEditDraft("");
    },
  });

  const deleteComment = trpc.comments.delete.useMutation({
    onMutate: async (vars) => {
      await utils.comments.list.cancel({ taskId });
      const prev = utils.comments.list.getData({ taskId });
      utils.comments.list.setData({ taskId }, (old) =>
        (old ?? []).filter((c) => c.id !== vars.commentId)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      utils.comments.list.setData({ taskId }, ctx?.prev);
      toast.error("Failed to delete comment.");
    },
    onSettled: () => {
      utils.comments.list.invalidate({ taskId });
    },
  });

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    if (comments.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    addComment.mutate({ taskId, content: trimmed });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      const trimmed = draft.trim();
      if (trimmed) addComment.mutate({ taskId, content: trimmed });
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          Comments
          {comments.length > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>

      {/* Comments list */}
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-5 space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No comments yet.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Be the first to leave a comment on this task.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {comments.map((comment) => {
              const isOwn = comment.userId === currentUserId;
              const canDelete = isOwn || currentUserRole === "admin";
              return (
                <div key={comment.id} className="px-5 py-4 flex items-start gap-3 group">
                  <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                      {getInitials(comment.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-semibold text-foreground">
                        {comment.userName ?? "User"}
                        {isOwn && (
                          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatRelativeTime(comment.createdAt)}
                        {comment.updatedAt > comment.createdAt && (
                          <span className="ml-1 italic">(edited)</span>
                        )}
                      </span>
                    </div>
                    {editingId === comment.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={2}
                          className="resize-none text-sm min-h-[60px] bg-background"
                          disabled={updateComment.isPending}
                          autoFocus
                          onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                              e.preventDefault();
                              if (editDraft.trim()) updateComment.mutate({ commentId: comment.id, content: editDraft.trim() });
                            }
                            if (e.key === "Escape") { setEditingId(null); setEditDraft(""); }
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs gap-1"
                            disabled={!editDraft.trim() || updateComment.isPending}
                            onClick={() => { if (editDraft.trim()) updateComment.mutate({ commentId: comment.id, content: editDraft.trim() }); }}
                          >
                            <Check className="h-3 w-3" />
                            {updateComment.isPending ? "Saving…" : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-3 text-xs gap-1"
                            onClick={() => { setEditingId(null); setEditDraft(""); }}
                          >
                            <X className="h-3 w-3" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                        {comment.content}
                      </p>
                    )}
                  </div>
                  {editingId !== comment.id && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 mt-0.5">
                      {isOwn && (
                        <button
                          onClick={() => { setEditingId(comment.id); setEditDraft(comment.content); }}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                          title="Edit comment"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => deleteComment.mutate({ commentId: comment.id })}
                          disabled={deleteComment.isPending}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Delete comment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Compose area */}
        <div className="p-4 border-t border-border bg-muted/20">
          <form onSubmit={handleSubmit} className="flex gap-3 items-end">
            <Avatar className="h-7 w-7 shrink-0 mb-0.5">
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                {getInitials(currentUserName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a comment… (Ctrl+Enter to send)"
                rows={2}
                className="resize-none text-sm min-h-[60px] bg-background"
                disabled={addComment.isPending}
              />
            </div>
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 shrink-0 mb-0.5"
              disabled={!draft.trim() || addComment.isPending}
              title="Send comment"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground mt-1.5 pl-10">
            Press Ctrl+Enter to send quickly
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Detail Row ───────────────────────────────────────────────────────────────

function DetailRow({
  icon: Icon,
  label,
  value,
  valueClass = "",
}: {
  icon: typeof User;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`text-xs font-medium text-foreground mt-0.5 ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}
