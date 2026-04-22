import { and, desc, eq, gte, inArray, isNull, like, lte, ne, or, sql, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activityLog,
  deviceTokens,
  InsertActivityLog,
  InsertTask,
  InsertUser,
  reminderJobs,
  taskComments,
  taskShares,
  tasks,
  userPreferences,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createEmailUser(data: {
  name: string;
  email: string;
  passwordHash: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const openId = `email_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    loginMethod: "email",
    lastSignedIn: new Date(),
  });
  return getUserByEmail(data.email);
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      openId: users.openId,
    })
    .from(users)
    .orderBy(users.name);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function deleteUserAndData(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Get all tasks created by this user
  const userTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.createdById, userId));
  const taskIds = userTasks.map((t) => t.id);
  if (taskIds.length > 0) {
    await db.delete(activityLog).where(inArray(activityLog.taskId, taskIds));
    await db.delete(taskShares).where(inArray(taskShares.taskId, taskIds));
    await db.delete(reminderJobs).where(inArray(reminderJobs.taskId, taskIds));
    await db.delete(tasks).where(inArray(tasks.id, taskIds));
  }
  // Remove user from shared tasks
  await db.delete(taskShares).where(eq(taskShares.userId, userId));
  // Remove device tokens and preferences
  await db.delete(deviceTokens).where(eq(deviceTokens.userId, userId));
  await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
  // Delete user
  await db.delete(users).where(eq(users.id, userId));
}

// ─── User Preferences ─────────────────────────────────────────────────────────

export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertUserPreferences(
  userId: number,
  prefs: {
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    maxRemindersPerDay?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(userPreferences)
    .values({ userId, ...prefs })
    .onDuplicateKeyUpdate({ set: { ...prefs, updatedAt: new Date() } });
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface TaskFilters {
  userId: number;
  priority?: "normal" | "priority" | "critical";
  status?: "pending" | "in_progress" | "completed" | "overdue" | "escalated";
  assignedToId?: number;
  search?: string;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  view?: "my_tasks" | "assigned_to_me" | "assigned_by_me" | "shared_with_me" | "waiting_on_others" | "all";
}

export async function getTasksForUser(filters: TaskFilters) {
  const db = await getDb();
  if (!db) return [];
  const sharedRows = await db
    .select({ taskId: taskShares.taskId })
    .from(taskShares)
    .where(eq(taskShares.userId, filters.userId));
  const sharedTaskIds = sharedRows.map((r) => r.taskId);
  const conditions: ReturnType<typeof eq>[] = [];

  if (filters.view === "assigned_to_me") {
    conditions.push(eq(tasks.assignedToId, filters.userId));
  } else if (filters.view === "assigned_by_me") {
    conditions.push(
      and(eq(tasks.createdById, filters.userId), ne(tasks.assignedToId, filters.userId))!
    );
  } else if (filters.view === "shared_with_me") {
    if (sharedTaskIds.length === 0) return [];
    conditions.push(inArray(tasks.id, sharedTaskIds) as ReturnType<typeof eq>);
  } else if (filters.view === "waiting_on_others") {
    // Creator = me, assigned to someone else, not completed
    conditions.push(
      and(
        eq(tasks.createdById, filters.userId),
        sql`${tasks.assignedToId} IS NOT NULL`,
        ne(tasks.assignedToId, filters.userId),
        ne(tasks.status, "completed")
      ) as ReturnType<typeof eq>
    );
  } else if (filters.view === "my_tasks") {
    const orConds = [eq(tasks.createdById, filters.userId), eq(tasks.assignedToId, filters.userId)];
    if (sharedTaskIds.length > 0) {
      orConds.push(inArray(tasks.id, sharedTaskIds) as ReturnType<typeof eq>);
    }
    conditions.push(or(...orConds) as ReturnType<typeof eq>);
  } else {
    const orConds = [eq(tasks.createdById, filters.userId), eq(tasks.assignedToId, filters.userId)];
    if (sharedTaskIds.length > 0) {
      orConds.push(inArray(tasks.id, sharedTaskIds) as ReturnType<typeof eq>);
    }
    conditions.push(or(...orConds) as ReturnType<typeof eq>);
  }

  if (filters.priority) conditions.push(eq(tasks.priority, filters.priority));
  if (filters.status) conditions.push(eq(tasks.status, filters.status));
  if (filters.assignedToId) conditions.push(eq(tasks.assignedToId, filters.assignedToId));
  if (filters.search) {
    conditions.push(
      or(
        like(tasks.title, `%${filters.search}%`),
        like(tasks.description, `%${filters.search}%`)
      ) as ReturnType<typeof eq>
    );
  }
  if (filters.dueDateFrom) conditions.push(gte(tasks.dueDate, filters.dueDateFrom));
  if (filters.dueDateTo) conditions.push(lte(tasks.dueDate, filters.dueDateTo));

  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.updatedAt));
  return rows;
}

export async function getTaskById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result[0];
}

export async function createTask(data: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tasks).values(data);
  return result[0];
}

export async function updateTask(id: number, data: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tasks).set(data).where(eq(tasks.id, id));
}

export async function deleteTask(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(taskShares).where(eq(taskShares.taskId, id));
  await db.delete(activityLog).where(eq(activityLog.taskId, id));
  await db.delete(reminderJobs).where(eq(reminderJobs.taskId, id));
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function touchTaskLastSeen(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(tasks).set({ lastSeenAt: new Date() }).where(eq(tasks.id, id));
}

// ─── Task Shares ──────────────────────────────────────────────────────────────

export async function getTaskShares(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: taskShares.id,
      taskId: taskShares.taskId,
      userId: taskShares.userId,
      sharedById: taskShares.sharedById,
      createdAt: taskShares.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(taskShares)
    .leftJoin(users, eq(taskShares.userId, users.id))
    .where(eq(taskShares.taskId, taskId));
}

export async function addTaskShare(taskId: number, userId: number, sharedById: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select()
    .from(taskShares)
    .where(and(eq(taskShares.taskId, taskId), eq(taskShares.userId, userId)))
    .limit(1);
  if (existing.length > 0) return; // already shared
  await db.insert(taskShares).values({ taskId, userId, sharedById });
}

export async function removeTaskShare(taskId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(taskShares)
    .where(and(eq(taskShares.taskId, taskId), eq(taskShares.userId, userId)));
}

export async function isUserAuthorizedForTask(taskId: number, userId: number): Promise<boolean> {
  const task = await getTaskById(taskId);
  if (!task) return false;
  if (task.createdById === userId || task.assignedToId === userId) return true;
  const db = await getDb();
  if (!db) return false;
  const share = await db
    .select()
    .from(taskShares)
    .where(and(eq(taskShares.taskId, taskId), eq(taskShares.userId, userId)))
    .limit(1);
  return share.length > 0;
}

/**
 * Check if a user is allowed to complete a task based on completionPermission.
 */
export async function canUserCompleteTask(taskId: number, userId: number): Promise<boolean> {
  const task = await getTaskById(taskId);
  if (!task) return false;
  const perm = task.completionPermission;
  if (perm === "creator_only") return task.createdById === userId;
  if (perm === "assignee_only") return task.assignedToId === userId;
  // any_participant — creator, assignee, or shared user
  return isUserAuthorizedForTask(taskId, userId);
}

/**
 * Get all user IDs who are participants of a task (creator + assignee + shared users).
 */
export async function getTaskParticipantIds(taskId: number): Promise<number[]> {
  const task = await getTaskById(taskId);
  if (!task) return [];
  const ids = new Set<number>([task.createdById]);
  if (task.assignedToId) ids.add(task.assignedToId);
  const db = await getDb();
  if (db) {
    const shares = await db
      .select({ userId: taskShares.userId })
      .from(taskShares)
      .where(eq(taskShares.taskId, taskId));
    shares.forEach((s) => ids.add(s.userId));
  }
  return Array.from(ids);
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export async function addActivityLog(entry: InsertActivityLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLog).values(entry);
}

export async function getActivityLogForTask(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: activityLog.id,
      taskId: activityLog.taskId,
      userId: activityLog.userId,
      action: activityLog.action,
      details: activityLog.details,
      createdAt: activityLog.createdAt,
      userName: users.name,
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.userId, users.id))
    .where(eq(activityLog.taskId, taskId))
    .orderBy(desc(activityLog.createdAt));
}

export async function getRecentActivity(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const sharedRows = await db
    .select({ taskId: taskShares.taskId })
    .from(taskShares)
    .where(eq(taskShares.userId, userId));
  const sharedTaskIds = sharedRows.map((r) => r.taskId);
  const userTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      or(
        eq(tasks.createdById, userId),
        eq(tasks.assignedToId, userId),
        ...(sharedTaskIds.length > 0 ? [inArray(tasks.id, sharedTaskIds)] : [])
      )
    );
  const taskIds = userTasks.map((t) => t.id);
  if (taskIds.length === 0) return [];
  return db
    .select({
      id: activityLog.id,
      taskId: activityLog.taskId,
      userId: activityLog.userId,
      action: activityLog.action,
      details: activityLog.details,
      createdAt: activityLog.createdAt,
      userName: users.name,
      taskTitle: tasks.title,
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.userId, users.id))
    .leftJoin(tasks, eq(activityLog.taskId, tasks.id))
    .where(inArray(activityLog.taskId, taskIds))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
}

// ─── Dashboard Summary ────────────────────────────────────────────────────────

export async function getDashboardSummary(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const sharedRows = await db
    .select({ taskId: taskShares.taskId })
    .from(taskShares)
    .where(eq(taskShares.userId, userId));
  const sharedTaskIds = sharedRows.map((r) => r.taskId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const allUserTaskConds = [
    eq(tasks.createdById, userId),
    eq(tasks.assignedToId, userId),
    ...(sharedTaskIds.length > 0 ? [inArray(tasks.id, sharedTaskIds)] : []),
  ];
  const [
    totalActive,
    assignedToMe,
    assignedByMe,
    sharedWithMe,
    overdue,
    completedToday,
    criticalCount,
    priorityCount,
    waitingOnOthers,
    escalatedCount,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(tasks).where(and(or(...allUserTaskConds), ne(tasks.status, "completed"))),
    db.select({ count: sql<number>`count(*)` }).from(tasks).where(and(eq(tasks.assignedToId, userId), ne(tasks.status, "completed"))),
    db.select({ count: sql<number>`count(*)` }).from(tasks).where(and(eq(tasks.createdById, userId), sql`${tasks.assignedToId} IS NOT NULL`, ne(tasks.assignedToId, userId), ne(tasks.status, "completed"))),
    sharedTaskIds.length > 0
      ? db.select({ count: sql<number>`count(*)` }).from(tasks).where(and(inArray(tasks.id, sharedTaskIds), ne(tasks.status, "completed")))
      : Promise.resolve([{ count: 0 }]),
    db.select({ count: sql<number>`count(*)` }).from(tasks).where(and(or(...allUserTaskConds), eq(tasks.status, "overdue"))),
    db.select({ count: sql<number>`count(*)` }).from(tasks).where(and(or(...allUserTaskConds), eq(tasks.status, "completed"), gte(tasks.completedAt, today), lte(tasks.completedAt, tomorrow))),
    db.select({ count: sql<number>`count(*)` }).from(tasks).where(and(or(...allUserTaskConds), eq(tasks.priority, "critical"), ne(tasks.status, "completed"))),
    db.select({ count: sql<number>`count(*)` }).from(tasks).where(and(or(...allUserTaskConds), eq(tasks.priority, "priority"), ne(tasks.status, "completed"))),
    db.select({ count: sql<number>`count(*)` }).from(tasks).where(and(eq(tasks.createdById, userId), sql`${tasks.assignedToId} IS NOT NULL`, ne(tasks.assignedToId, userId), ne(tasks.status, "completed"))),
    db.select({ count: sql<number>`count(*)` }).from(tasks).where(and(or(...allUserTaskConds), eq(tasks.status, "escalated"))),
  ]);
  return {
    totalActive: Number(totalActive[0]?.count ?? 0),
    assignedToMe: Number(assignedToMe[0]?.count ?? 0),
    assignedByMe: Number(assignedByMe[0]?.count ?? 0),
    sharedWithMe: Number(sharedWithMe[0]?.count ?? 0),
    overdue: Number(overdue[0]?.count ?? 0),
    completedToday: Number(completedToday[0]?.count ?? 0),
    critical: Number(criticalCount[0]?.count ?? 0),
    priority: Number(priorityCount[0]?.count ?? 0),
    waitingOnOthers: Number(waitingOnOthers[0]?.count ?? 0),
    escalated: Number(escalatedCount[0]?.count ?? 0),
  };
}

// ─── Rollover / Overdue ───────────────────────────────────────────────────────

export async function markOverdueTasks() {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const result = await db
    .update(tasks)
    .set({ status: "overdue", isOverdue: true })
    .where(
      and(
        lte(tasks.dueDate, now),
        ne(tasks.status, "completed"),
        ne(tasks.status, "overdue"),
        ne(tasks.status, "escalated")
      )
    );
  return (result as unknown as { affectedRows: number }[])[0]?.affectedRows ?? 0;
}

// ─── Reminder Jobs ────────────────────────────────────────────────────────────

export async function createReminderJob(data: {
  taskId: number;
  intervalMinutes: number;
  recipients: number[];
  createdById: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Stop any existing active job for this task
  await db
    .update(reminderJobs)
    .set({ status: "stopped" })
    .where(and(eq(reminderJobs.taskId, data.taskId), eq(reminderJobs.status, "active")));
  // Create new job
  const nextRunAt = new Date(Date.now() + data.intervalMinutes * 60 * 1000);
  await db.insert(reminderJobs).values({
    taskId: data.taskId,
    intervalMinutes: data.intervalMinutes,
    nextRunAt,
    status: "active",
    recipients: JSON.stringify(data.recipients),
    reminderCount: 0,
    createdById: data.createdById,
  });
}

export async function stopReminderJobsForTask(taskId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(reminderJobs)
    .set({ status: "stopped" })
    .where(and(eq(reminderJobs.taskId, taskId), eq(reminderJobs.status, "active")));
}

export async function getDueReminderJobs() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db
    .select()
    .from(reminderJobs)
    .where(and(eq(reminderJobs.status, "active"), lte(reminderJobs.nextRunAt, now)));
}

export async function updateReminderJobAfterRun(
  jobId: number,
  intervalMinutes: number,
  newCount: number
) {
  const db = await getDb();
  if (!db) return;
  const nextRunAt = new Date(Date.now() + intervalMinutes * 60 * 1000);
  await db
    .update(reminderJobs)
    .set({ lastRunAt: new Date(), nextRunAt, reminderCount: newCount })
    .where(eq(reminderJobs.id, jobId));
}

export async function getReminderJobsForTask(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reminderJobs).where(eq(reminderJobs.taskId, taskId));
}

// ─── Legacy Reminders (backward compat) ──────────────────────────────────────

export async function getTasksDueForReminder() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const allRemindable = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.reminderEnabled, true),
        ne(tasks.status, "completed"),
        sql`${tasks.reminderIntervalMinutes} IS NOT NULL`
      )
    );
  return allRemindable.filter((task) => {
    const intervalMs = (task.reminderIntervalMinutes ?? 60) * 60 * 1000;
    const lastSent = task.lastReminderSentAt ?? task.createdAt;
    return now.getTime() - lastSent.getTime() >= intervalMs;
  });
}

// ─── Task Comments ────────────────────────────────────────────────────────────
export async function getCommentsForTask(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  // Join with users to get commenter name and email
  const rows = await db
    .select({
      id: taskComments.id,
      taskId: taskComments.taskId,
      userId: taskComments.userId,
      content: taskComments.content,
      createdAt: taskComments.createdAt,
      updatedAt: taskComments.updatedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(taskComments)
    .innerJoin(users, eq(taskComments.userId, users.id))
    .where(and(eq(taskComments.taskId, taskId), isNull(taskComments.deletedAt)))
    .orderBy(taskComments.createdAt);
  return rows;
}

export async function addComment(taskId: number, userId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db
    .insert(taskComments)
    .values({ taskId, userId, content });
  return { id: (result as { insertId: number }).insertId };
}

export async function deleteComment(commentId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Only allow deletion by the comment author
  await db
    .delete(taskComments)
    .where(and(eq(taskComments.id, commentId), eq(taskComments.userId, userId)));
}

export async function getCommentById(commentId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(taskComments)
    .where(eq(taskComments.id, commentId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateComment(commentId: number, userId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(taskComments)
    .set({ content, updatedAt: new Date() })
    .where(and(eq(taskComments.id, commentId), eq(taskComments.userId, userId)));
}

export async function softDeleteComment(commentId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(taskComments)
    .set({ deletedAt: new Date() })
    .where(and(eq(taskComments.id, commentId), eq(taskComments.userId, userId)));
}
