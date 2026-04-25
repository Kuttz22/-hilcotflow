import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  json,
  tinyint,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Email + password auth (nullable — Manus OAuth users have no password)
  passwordHash: varchar("passwordHash", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── User Preferences ─────────────────────────────────────────────────────────

export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // Quiet hours: stored as HH:MM strings e.g. "22:00", "07:00"
  quietHoursStart: varchar("quietHoursStart", { length: 5 }),
  quietHoursEnd: varchar("quietHoursEnd", { length: 5 }),
  maxRemindersPerDay: int("maxRemindersPerDay").default(10).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

// ─── Device Tokens (FCM / APNs) ───────────────────────────────────────────────

export const deviceTokens = mysqlTable("device_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 512 }).notNull(),
  platform: mysqlEnum("platform", ["web", "android", "ios"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DeviceToken = typeof deviceTokens.$inferSelect;
export type InsertDeviceToken = typeof deviceTokens.$inferInsert;

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: mysqlEnum("priority", ["normal", "priority", "critical"]).default("normal").notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "overdue", "escalated"]).default("pending").notNull(),
  dueDate: timestamp("dueDate"),
  createdById: int("createdById").notNull(),
  assignedToId: int("assignedToId"),
  completedById: int("completedById"),
  completedAt: timestamp("completedAt"),
  // Completion permission control
  completionPermission: mysqlEnum("completionPermission", ["creator_only", "assignee_only", "any_participant"]).default("any_participant").notNull(),
  // Rollover / visibility fields
  isOverdue: boolean("isOverdue").default(false).notNull(),
  lastSeenAt: timestamp("lastSeenAt"),
  // Legacy reminder settings (kept for backward compat, superseded by reminder_jobs)
  reminderEnabled: boolean("reminderEnabled").default(false).notNull(),
  reminderIntervalMinutes: int("reminderIntervalMinutes"),
  reminderRecipients: mysqlEnum("reminderRecipients", ["assignee", "shared", "all"]).default("assignee"),
  lastReminderSentAt: timestamp("lastReminderSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ─── Reminder Jobs ────────────────────────────────────────────────────────────

export const reminderJobs = mysqlTable("reminder_jobs", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  intervalMinutes: int("intervalMinutes").notNull(),
  nextRunAt: timestamp("nextRunAt").notNull(),
  lastRunAt: timestamp("lastRunAt"),
  status: mysqlEnum("status", ["active", "stopped"]).default("active").notNull(),
  // JSON array of user IDs to notify e.g. [1, 2, 3]
  recipients: text("recipients").notNull(), // stored as JSON string
  reminderCount: int("reminderCount").default(0).notNull(),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReminderJob = typeof reminderJobs.$inferSelect;
export type InsertReminderJob = typeof reminderJobs.$inferInsert;

// ─── Task Shares ──────────────────────────────────────────────────────────────

export const taskShares = mysqlTable("task_shares", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  sharedById: int("sharedById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskShare = typeof taskShares.$inferSelect;
export type InsertTaskShare = typeof taskShares.$inferInsert;

// ─── Activity Log ─────────────────────────────────────────────────────────────

export const activityLog = mysqlTable("activity_log", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  action: mysqlEnum("action", [
    "created",
    "updated",
    "assigned",
    "shared",
    "unshared",
    "status_changed",
    "completed",
    "reopened",
    "reminder_sent",
    "priority_changed",
    "due_date_changed",
    "escalated",
    "escalation_alert",
  ]).notNull(),
  details: text("details"), // JSON string with before/after values
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

// ─── Task Comments ────────────────────────────────────────────────────────────
export const taskComments = mysqlTable("task_comments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});
export type TaskComment = typeof taskComments.$inferSelect;
export type InsertTaskComment = typeof taskComments.$inferInsert;
