import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { X, Bell } from "lucide-react";
import { getInitials } from "@/lib/taskUtils";
import { Avatar, AvatarFallback } from "./ui/avatar";

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editTask?: {
    id: number;
    title: string;
    description: string | null;
    priority: "normal" | "priority" | "critical";
    status: "pending" | "in_progress" | "completed" | "overdue" | "escalated";
    dueDate: Date | null;
    assignedToId: number | null;
    reminderEnabled: boolean;
    reminderIntervalMinutes: number | null;
    reminderRecipients: "assignee" | "shared" | "all" | null;
  } | null;
}

export function TaskFormModal({ open, onClose, onSuccess, editTask }: TaskFormModalProps) {
  const utils = trpc.useUtils();
  const { data: users = [] } = trpc.users.list.useQuery();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"normal" | "priority" | "critical">("normal");
  const [status, setStatus] = useState<"pending" | "in_progress" | "completed" | "overdue" | "escalated">("pending");
  const [dueDate, setDueDate] = useState("");
  const [assignedToId, setAssignedToId] = useState<string>("");
  const [sharedUserIds, setSharedUserIds] = useState<number[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderInterval, setReminderInterval] = useState<string>("60");
  const [reminderRecipients, setReminderRecipients] = useState<"assignee" | "shared" | "all">("assignee");
  const [customInterval, setCustomInterval] = useState("");

  const showReminderPanel = priority === "priority" || priority === "critical";

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description ?? "");
      setPriority(editTask.priority);
      setStatus(editTask.status);
      setDueDate(editTask.dueDate ? new Date(editTask.dueDate).toISOString().split("T")[0] : "");
      setAssignedToId(editTask.assignedToId?.toString() ?? "");
      setReminderEnabled(editTask.reminderEnabled);
      setReminderInterval(editTask.reminderIntervalMinutes?.toString() ?? "60");
      setReminderRecipients(editTask.reminderRecipients ?? "assignee");
    } else {
      setTitle("");
      setDescription("");
      setPriority("normal");
      setStatus("pending");
      setDueDate("");
      setAssignedToId("");
      setSharedUserIds([]);
      setReminderEnabled(false);
      setReminderInterval("60");
      setReminderRecipients("assignee");
      setCustomInterval("");
    }
  }, [editTask, open]);

  // Auto-enable reminder when priority/critical selected
  useEffect(() => {
    if (priority === "critical") setReminderEnabled(true);
  }, [priority]);

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Task created successfully");
      utils.tasks.list.invalidate();
      utils.dashboard.summary.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      toast.success("Task updated successfully");
      utils.tasks.list.invalidate();
      utils.dashboard.summary.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title is required");

    const intervalMins = reminderInterval === "custom"
      ? parseInt(customInterval) || 60
      : parseInt(reminderInterval);

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      assignedToId: assignedToId ? parseInt(assignedToId) : undefined,
      reminderEnabled: showReminderPanel ? reminderEnabled : false,
      reminderIntervalMinutes: showReminderPanel && reminderEnabled ? intervalMins : undefined,
      reminderRecipients: showReminderPanel && reminderEnabled ? reminderRecipients : undefined,
    };

    if (editTask) {
      updateMutation.mutate({ id: editTask.id, ...payload, status });
    } else {
      createMutation.mutate({ ...payload, sharedUserIds });
    }
  };

  const toggleSharedUser = (userId: number) => {
    setSharedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {editTask ? "Edit Task" : "Create New Task"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-sm font-medium">Title <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="h-9"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="desc" className="text-sm font-medium">Description</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          {/* Priority + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="priority">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                      Priority
                    </span>
                  </SelectItem>
                  <SelectItem value="critical">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                      Critical
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editTask && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {!editTask && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Due Date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-9"
                />
              </div>
            )}
          </div>

          {editTask && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9"
              />
            </div>
          )}

          {/* Assign To */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Assign To</Label>
            <Select value={assignedToId} onValueChange={setAssignedToId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select team member..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    <span className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px]">{getInitials(u.name)}</AvatarFallback>
                      </Avatar>
                      {u.name ?? u.email ?? `User ${u.id}`}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Share With */}
          {!editTask && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Share With</Label>
              <div className="flex flex-wrap gap-2 min-h-[36px] p-2 border rounded-md bg-muted/30">
                {users.map((u) => {
                  const isSelected = sharedUserIds.includes(u.id);
                  const isAssigned = assignedToId === u.id.toString();
                  if (isAssigned) return null;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleSharedUser(u.id)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-background border border-border hover:bg-accent"
                      }`}
                    >
                      {getInitials(u.name)}
                      {isSelected && <X className="w-3 h-3" />}
                    </button>
                  );
                })}
                {users.length === 0 && (
                  <span className="text-xs text-muted-foreground">No team members available</span>
                )}
              </div>
              {sharedUserIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Sharing with {sharedUserIds.length} team member{sharedUserIds.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}

          {/* Reminder Panel — only for priority/critical */}
          {showReminderPanel && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-900">Reminder Settings</span>
                </div>
                <Switch
                  checked={reminderEnabled}
                  onCheckedChange={setReminderEnabled}
                />
              </div>

              {reminderEnabled && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-amber-800">Reminder Frequency</Label>
                    <Select value={reminderInterval} onValueChange={setReminderInterval}>
                      <SelectTrigger className="h-8 text-sm bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">Every 1 hour</SelectItem>
                        <SelectItem value="120">Every 2 hours</SelectItem>
                        <SelectItem value="240">Every 4 hours</SelectItem>
                        <SelectItem value="custom">Custom interval</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {reminderInterval === "custom" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-amber-800">Custom interval (minutes)</Label>
                      <Input
                        type="number"
                        min="15"
                        max="1440"
                        value={customInterval}
                        onChange={(e) => setCustomInterval(e.target.value)}
                        placeholder="e.g. 90"
                        className="h-8 text-sm bg-white"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-amber-800">Notify</Label>
                    <Select value={reminderRecipients} onValueChange={(v) => setReminderRecipients(v as typeof reminderRecipients)}>
                      <SelectTrigger className="h-8 text-sm bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assignee">Assignee only</SelectItem>
                        <SelectItem value="shared">All shared users</SelectItem>
                        <SelectItem value="all">Creator + all participants</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : editTask ? "Save Changes" : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
