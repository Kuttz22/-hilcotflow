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
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
    // Email + password auth (nullable — Manus OAuth users have no password)
    passwordHash: varchar("passwordHash", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (table) => ({
    // Prevent duplicate accounts for the same email across auth methods.
    // Must merge any existing duplicates before applying this constraint.
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
  })
);

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
  // digestOptOut: true = user has opted out of daily workspace digest emails
  digestOptOut: boolean("digestOptOut").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

// ─── Device Tokens (FCM / APNs) ───────────────────────────────────────────────

export const deviceTokens = mysqlTable(
  "device_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    token: varchar("token", { length: 512 }).notNull(),
    platform: mysqlEnum("platform", ["web", "android", "ios"]).notNull(),
    // For iOS tokens: "sandbox" = Debug/development APNs, "production" = Release/production APNs
    apnsEnvironment: mysqlEnum("apnsEnvironment", ["sandbox", "production"]).default("production"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    tokenUnique: uniqueIndex("device_tokens_token_unique").on(table.token),
  })
);

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
  // Workspace scoping (null = personal task)
  workspaceId: int("workspaceId"),
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
    "commented",
    "file_attached",
    "file_deleted",
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
  // parentCommentId: reserved for future threaded replies — null means top-level
  parentCommentId: int("parentCommentId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});
export type TaskComment = typeof taskComments.$inferSelect;
export type InsertTaskComment = typeof taskComments.$inferInsert;

// ─── Comment Mentions ─────────────────────────────────────────────────────────
// Structured mention records — one row per @mention in a comment.
// userId is the mentioned user; resolved at write time from the workspace member list.
export const commentMentions = mysqlTable("comment_mentions", {
  id: int("id").autoincrement().primaryKey(),
  commentId: int("commentId").notNull(),
  userId: int("userId").notNull(),
  notifiedAt: timestamp("notifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CommentMention = typeof commentMentions.$inferSelect;
export type InsertCommentMention = typeof commentMentions.$inferInsert;

// ─── Task Follows ─────────────────────────────────────────────────────────────
// Tracks whether a user is following or has muted a task for comment notifications.
export const taskFollows = mysqlTable("task_follows", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  // muted: true = user explicitly opted out of comment notifications for this task
  muted: boolean("muted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TaskFollow = typeof taskFollows.$inferSelect;
export type InsertTaskFollow = typeof taskFollows.$inferInsert;

// ─── Comment Reactions ──────────────────────────────────────────────────────
// Emoji reactions on comments. One row per (commentId, userId, emoji) — unique.
export const commentReactions = mysqlTable("comment_reactions", {
  id: int("id").autoincrement().primaryKey(),
  commentId: int("commentId").notNull(),
  userId: int("userId").notNull(),
  // Fixed emoji set: 👍 ✅ 👀 🔥 ❓
  emoji: varchar("emoji", { length: 8 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CommentReaction = typeof commentReactions.$inferSelect;
export type InsertCommentReaction = typeof commentReactions.$inferInsert;

// ─── Personal Groups ──────────────────────────────────────────────────────────

export const personalGroups = mysqlTable("personal_groups", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  // type: system = auto-created defaults, custom = user-created
  type: mysqlEnum("type", ["system", "custom"]).default("custom").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PersonalGroup = typeof personalGroups.$inferSelect;
export type InsertPersonalGroup = typeof personalGroups.$inferInsert;

// ─── Personal Group Members ───────────────────────────────────────────────────

export const personalGroupMembers = mysqlTable("personal_group_members", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  memberId: int("memberId").notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type PersonalGroupMember = typeof personalGroupMembers.$inferSelect;
export type InsertPersonalGroupMember = typeof personalGroupMembers.$inferInsert;

// ─── Directory Connections ────────────────────────────────────────────────────

export const directoryConnections = mysqlTable("directory_connections", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  contactId: int("contactId").notNull(),
  // source: how this connection was created
  source: mysqlEnum("source", ["invite", "manual", "group", "workspace"]).default("manual").notNull(),
  // nickname: user-defined label for this contact (e.g. "Mum", "Boss")
  nickname: varchar("nickname", { length: 100 }),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type DirectoryConnection = typeof directoryConnections.$inferSelect;
export type InsertDirectoryConnection = typeof directoryConnections.$inferInsert;

// ─── Invitations ──────────────────────────────────────────────────────────────

export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  inviterId: int("inviterId").notNull(),
  // At least one of email or phone must be non-null (enforced at application layer)
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  // Optional: add invitee to this group on acceptance
  groupId: int("groupId"),
  // Secure random token for the invite link
  token: varchar("token", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "accepted", "declined", "expired"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  acceptedAt: timestamp("acceptedAt"),
});

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;

// ─── Workspaces ───────────────────────────────────────────────────────────────

export const workspaces = mysqlTable("workspaces", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  // URL-safe slug; not editable after creation
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  ownerId: int("ownerId").notNull(),
  avatarUrl: varchar("avatarUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = typeof workspaces.$inferInsert;

// ─── Workspace Members ────────────────────────────────────────────────────────

export const workspaceMembers = mysqlTable("workspace_members", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  userId: int("userId").notNull(),
  // role: admin = full control, member = create/assign tasks, viewer = read-only
  role: mysqlEnum("role", ["admin", "member", "viewer"]).default("member").notNull(),
  invitedById: int("invitedById"),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type InsertWorkspaceMember = typeof workspaceMembers.$inferInsert;

// ─── Workspace Invitations ────────────────────────────────────────────────────

export const workspaceInvitations = mysqlTable("workspace_invitations", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  invitedById: int("invitedById").notNull(),
  email: varchar("email", { length: 255 }), // nullable — link-based invites have no target email
  // Role to grant on acceptance
  role: mysqlEnum("role", ["admin", "member", "viewer"]).default("member").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "accepted", "declined", "expired"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  acceptedAt: timestamp("acceptedAt"),
});
export type WorkspaceInvitation = typeof workspaceInvitations.$inferSelect;
export type InsertWorkspaceInvitation = typeof workspaceInvitations.$inferInsert;

// ─── Task Attachments ─────────────────────────────────────────────────────────
// Files uploaded to S3 and linked to a task. Downloads use signed URLs.
export const taskAttachments = mysqlTable("task_attachments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  uploadedById: int("uploadedById").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileSize: int("fileSize").notNull(), // bytes
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  // S3 object key — used for signed URL generation and deletion
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TaskAttachment = typeof taskAttachments.$inferSelect;
export type InsertTaskAttachment = typeof taskAttachments.$inferInsert;
