import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addActivityLog,
  addComment,
  addTaskShare,
  canUserCompleteTask,
  createEmailUser,
  createReminderJob,
  createTask,
  deleteComment,
  softDeleteComment,
  updateComment,
  deleteTask,
  deleteUserAndData,
  getAllUsers,
  getActivityLogForTask,
  getCommentById,
  getCommentsForTask,
  getDashboardSummary,
  getRecentActivity,
  getReminderJobsForTask,
  getTaskById,
  getTaskParticipantIds,
  getTaskShares,
  getTasksDueForReminder,
  getTasksForUser,
  getUserByEmail,
  getUserById,
  getUserPreferences,
  isUserAuthorizedForTask,
  markOverdueTasks,
  removeTaskShare,
  stopReminderJobsForTask,
  touchTaskLastSeen,
  updateTask,
  upsertUserPreferences,
} from "./db";
import { registerDeviceToken, removeDeviceToken } from "./pushNotifications";
import { notifyOwner } from "./_core/notification";
import { ENV } from "./_core/env";

// ─── Shared Zod Schemas ───────────────────────────────────────────────────────

const priorityEnum = z.enum(["normal", "priority", "critical"]);
const statusEnum = z.enum(["pending", "in_progress", "completed", "overdue", "escalated"]);
const reminderRecipientsEnum = z.enum(["assignee", "shared", "all"]);
const completionPermissionEnum = z.enum(["creator_only", "assignee_only", "any_participant"]);
const viewEnum = z.enum([
  "my_tasks",
  "assigned_to_me",
  "assigned_by_me",
  "shared_with_me",
  "waiting_on_others",
  "all",
]);

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // Email + password registration
    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          email: z.string().email().max(320),
          password: z.string().min(8).max(128),
        })
      )
      .mutation(async ({ input }) => {
        const existing = await getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An account with this email already exists.",
          });
        }
        const passwordHash = await bcrypt.hash(input.password, 12);
        const user = await createEmailUser({
          name: input.name,
          email: input.email,
          passwordHash,
          openId: `email:${input.email}`,
          loginMethod: "password",
        });
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return { success: true, userId: user.id };
      }),

    // Email + password login — returns a session token (same flow as OAuth)
    emailLogin: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password.",
          });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password.",
          });
        }
        // Issue a session cookie using the same mechanism as OAuth
        const { sdk } = await import("./_core/sdk");
        const token = await sdk.createSessionToken(user.openId ?? `email:${user.email}`, { name: user.name ?? "" });
        ctx.res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: ONE_YEAR_MS,
  });
        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),

    // Account deletion — permanently removes user and all their data
    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
      await deleteUserAndData(ctx.user.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
  }),

  // ─── Users ─────────────────────────────────────────────────────────────────
  users: router({
    list: protectedProcedure.query(async () => {
      return getAllUsers();
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getUserById(input.id);
      }),
  }),

  // ─── Tasks ─────────────────────────────────────────────────────────────────
  tasks: router({
    list: protectedProcedure
      .input(
        z.object({
          priority: priorityEnum.optional(),
          status: statusEnum.optional(),
          assignedToId: z.number().optional(),
          search: z.string().optional(),
          dueDateFrom: z.date().optional(),
          dueDateTo: z.date().optional(),
          view: viewEnum.optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const taskRows = await getTasksForUser({ userId: ctx.user.id, ...input });
        const userIds = new Set<number>();
        taskRows.forEach((t) => {
          if (t.createdById) userIds.add(t.createdById);
          if (t.assignedToId) userIds.add(t.assignedToId);
          if (t.completedById) userIds.add(t.completedById);
        });
        const userMap: Record<number, { name: string | null; email: string | null }> = {};
        await Promise.all(
          Array.from(userIds).map(async (id) => {
            const u = await getUserById(id);
            if (u) userMap[id] = { name: u.name, email: u.email };
          })
        );
        return taskRows.map((t) => ({
          ...t,
          createdByName: userMap[t.createdById]?.name ?? null,
          assignedToName: t.assignedToId ? (userMap[t.assignedToId]?.name ?? null) : null,
          completedByName: t.completedById ? (userMap[t.completedById]?.name ?? null) : null,
        }));
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const authorized = await isUserAuthorizedForTask(input.id, ctx.user.id);
        if (!authorized) throw new TRPCError({ code: "FORBIDDEN" });
        const task = await getTaskById(input.id);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        // Update last seen timestamp
        await touchTaskLastSeen(input.id);
        const [shares, activity, createdBy, assignedTo, reminderJobsList] = await Promise.all([
          getTaskShares(input.id),
          getActivityLogForTask(input.id),
          getUserById(task.createdById),
          task.assignedToId ? getUserById(task.assignedToId) : null,
          getReminderJobsForTask(input.id),
        ]);
        const activeReminderJob = reminderJobsList.find((j) => j.status === "active") ?? null;
        return {
          ...task,
          createdByName: createdBy?.name ?? null,
          createdByEmail: createdBy?.email ?? null,
          assignedToName: assignedTo?.name ?? null,
          assignedToEmail: assignedTo?.email ?? null,
          shares,
          activity,
          activeReminderJob,
        };
      }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().optional(),
          priority: priorityEnum.default("normal"),
          dueDate: z.date().optional(),
          assignedToId: z.number().optional(),
          sharedUserIds: z.array(z.number()).optional(),
          completionPermission: completionPermissionEnum.default("any_participant"),
          reminderEnabled: z.boolean().default(false),
          reminderIntervalMinutes: z.number().optional(),
          reminderRecipients: reminderRecipientsEnum.optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { sharedUserIds, ...taskData } = input;
        await createTask({
          ...taskData,
          createdById: ctx.user.id,
          status: "pending",
          dueDate: taskData.dueDate ?? null,
          assignedToId: taskData.assignedToId ?? null,
          reminderEnabled: taskData.reminderEnabled,
          reminderIntervalMinutes: taskData.reminderIntervalMinutes ?? null,
          reminderRecipients: taskData.reminderRecipients ?? null,
          completionPermission: taskData.completionPermission,
        });
        const allTasks = await getTasksForUser({ userId: ctx.user.id });
        const newTask = allTasks.sort((a, b) => b.id - a.id)[0];
        if (!newTask) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        if (sharedUserIds?.length) {
          await Promise.all(
            sharedUserIds.map((uid) => addTaskShare(newTask.id, uid, ctx.user.id))
          );
        }

        await addActivityLog({
          taskId: newTask.id,
          userId: ctx.user.id,
          action: "created",
          details: JSON.stringify({ title: newTask.title, priority: newTask.priority }),
        });

        if (taskData.assignedToId && taskData.assignedToId !== ctx.user.id) {
          await addActivityLog({
            taskId: newTask.id,
            userId: ctx.user.id,
            action: "assigned",
            details: JSON.stringify({ assignedToId: taskData.assignedToId }),
          });
        }

        // Create reminder_job if reminders enabled
        if (taskData.reminderEnabled && taskData.reminderIntervalMinutes) {
          const participantIds = await getTaskParticipantIds(newTask.id);
          await createReminderJob({
            taskId: newTask.id,
            intervalMinutes: taskData.reminderIntervalMinutes,
            recipients: participantIds,
            createdById: ctx.user.id,
          });
        }

        return newTask;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          priority: priorityEnum.optional(),
          status: statusEnum.optional(),
          dueDate: z.date().nullable().optional(),
          assignedToId: z.number().nullable().optional(),
          completionPermission: completionPermissionEnum.optional(),
          reminderEnabled: z.boolean().optional(),
          reminderIntervalMinutes: z.number().nullable().optional(),
          reminderRecipients: reminderRecipientsEnum.optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        const authorized = await isUserAuthorizedForTask(id, ctx.user.id);
        if (!authorized) throw new TRPCError({ code: "FORBIDDEN" });
        const oldTask = await getTaskById(id);
        if (!oldTask) throw new TRPCError({ code: "NOT_FOUND" });

        await updateTask(id, {
          ...updates,
          dueDate: updates.dueDate ?? undefined,
          assignedToId: updates.assignedToId ?? undefined,
          reminderIntervalMinutes: updates.reminderIntervalMinutes ?? undefined,
        });

        // Log changes
        if (updates.priority && updates.priority !== oldTask.priority) {
          await addActivityLog({
            taskId: id,
            userId: ctx.user.id,
            action: "priority_changed",
            details: JSON.stringify({ from: oldTask.priority, to: updates.priority }),
          });
        }
        if (updates.status && updates.status !== oldTask.status) {
          await addActivityLog({
            taskId: id,
            userId: ctx.user.id,
            action: "status_changed",
            details: JSON.stringify({ from: oldTask.status, to: updates.status }),
          });
        }
        if (updates.assignedToId !== undefined && updates.assignedToId !== oldTask.assignedToId) {
          await addActivityLog({
            taskId: id,
            userId: ctx.user.id,
            action: "assigned",
            details: JSON.stringify({ assignedToId: updates.assignedToId }),
          });
        }
        if (updates.dueDate !== undefined) {
          await addActivityLog({
            taskId: id,
            userId: ctx.user.id,
            action: "due_date_changed",
            details: JSON.stringify({ dueDate: updates.dueDate }),
          });
        }
        if (
          updates.reminderEnabled !== undefined ||
          updates.reminderIntervalMinutes !== undefined
        ) {
          await addActivityLog({
            taskId: id,
            userId: ctx.user.id,
            action: "updated",
            details: JSON.stringify({ reminderEnabled: updates.reminderEnabled }),
          });
          // Update reminder_job
          if (updates.reminderEnabled && updates.reminderIntervalMinutes) {
            const participantIds = await getTaskParticipantIds(id);
            await createReminderJob({
              taskId: id,
              intervalMinutes: updates.reminderIntervalMinutes,
              recipients: participantIds,
              createdById: ctx.user.id,
            });
          } else if (updates.reminderEnabled === false) {
            await stopReminderJobsForTask(id);
          }
        }

        return getTaskById(id);
      }),

    complete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const canComplete = await canUserCompleteTask(input.id, ctx.user.id);
        if (!canComplete) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to complete this task based on its completion policy.",
          });
        }
        await updateTask(input.id, {
          status: "completed",
          completedById: ctx.user.id,
          completedAt: new Date(),
          reminderEnabled: false,
        });
        // Stop all reminder jobs immediately
        await stopReminderJobsForTask(input.id);
        await addActivityLog({
          taskId: input.id,
          userId: ctx.user.id,
          action: "completed",
          details: JSON.stringify({ completedById: ctx.user.id }),
        });
        return { success: true };
      }),

    reopen: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const authorized = await isUserAuthorizedForTask(input.id, ctx.user.id);
        if (!authorized) throw new TRPCError({ code: "FORBIDDEN" });
        await updateTask(input.id, {
          status: "pending",
          completedById: undefined,
          completedAt: undefined,
        });
        await addActivityLog({
          taskId: input.id,
          userId: ctx.user.id,
          action: "reopened",
          details: JSON.stringify({ reopenedById: ctx.user.id }),
        });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await getTaskById(input.id);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        if (task.createdById !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await deleteTask(input.id);
        return { success: true };
      }),

    // ─── Shares ──────────────────────────────────────────────────────────────
    getShares: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ ctx, input }) => {
        const authorized = await isUserAuthorizedForTask(input.taskId, ctx.user.id);
        if (!authorized) throw new TRPCError({ code: "FORBIDDEN" });
        return getTaskShares(input.taskId);
      }),

    addShare: protectedProcedure
      .input(z.object({ taskId: z.number(), userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const authorized = await isUserAuthorizedForTask(input.taskId, ctx.user.id);
        if (!authorized) throw new TRPCError({ code: "FORBIDDEN" });
        await addTaskShare(input.taskId, input.userId, ctx.user.id);
        await addActivityLog({
          taskId: input.taskId,
          userId: ctx.user.id,
          action: "shared",
          details: JSON.stringify({ sharedWithId: input.userId }),
        });
        // Update reminder job recipients if active
        const jobs = await getReminderJobsForTask(input.taskId);
        const activeJob = jobs.find((j) => j.status === "active");
        if (activeJob) {
          const participantIds = await getTaskParticipantIds(input.taskId);
          await createReminderJob({
            taskId: input.taskId,
            intervalMinutes: activeJob.intervalMinutes,
            recipients: participantIds,
            createdById: ctx.user.id,
          });
        }
        return { success: true };
      }),

    removeShare: protectedProcedure
      .input(z.object({ taskId: z.number(), userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const authorized = await isUserAuthorizedForTask(input.taskId, ctx.user.id);
        if (!authorized) throw new TRPCError({ code: "FORBIDDEN" });
        await removeTaskShare(input.taskId, input.userId);
        await addActivityLog({
          taskId: input.taskId,
          userId: ctx.user.id,
          action: "unshared",
          details: JSON.stringify({ removedUserId: input.userId }),
        });
        return { success: true };
      }),

    // ─── Activity ─────────────────────────────────────────────────────────────
    getActivity: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ ctx, input }) => {
        const authorized = await isUserAuthorizedForTask(input.taskId, ctx.user.id);
        if (!authorized) throw new TRPCError({ code: "FORBIDDEN" });
        return getActivityLogForTask(input.taskId);
      }),
  }),

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      return getDashboardSummary(ctx.user.id);
    }),
    recentActivity: protectedProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ ctx, input }) => {
        return getRecentActivity(ctx.user.id, input.limit);
      }),
  }),

  // ─── Notifications & Preferences ──────────────────────────────────────────
  notifications: router({
    // Register a device token for push notifications
    registerDevice: protectedProcedure
      .input(
        z.object({
          token: z.string().min(1),
          platform: z.enum(["web", "android", "ios"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await registerDeviceToken(ctx.user.id, input.token, input.platform);
        return { success: true };
      }),

    // Remove a device token (on logout or permission revoked)
    removeDevice: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        await removeDeviceToken(input.token);
        return { success: true };
      }),

    // Get user notification preferences
    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      return getUserPreferences(ctx.user.id);
    }),

    // Update user notification preferences
    updatePreferences: protectedProcedure
      .input(
        z.object({
          quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
          quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
          maxRemindersPerDay: z.number().min(1).max(50).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await upsertUserPreferences(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // ─── System / Maintenance ──────────────────────────────────────────────────
  maintenance: router({
    markOverdue: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const count = await markOverdueTasks();
      return { markedOverdue: count };
    }),
    processReminders: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const dueTasks = await getTasksDueForReminder();
      let sent = 0;
      for (const task of dueTasks) {
        await updateTask(task.id, { lastReminderSentAt: new Date() });
        await addActivityLog({
          taskId: task.id,
          userId: task.createdById,
          action: "reminder_sent",
          details: JSON.stringify({ title: task.title }),
        });
        try {
          await notifyOwner({
            title: `Reminder: ${task.title}`,
            content: `This task is still pending. Priority: ${task.priority}`,
          });
        } catch (_) {}
        sent++;
      }
      return { sent };
    }),
   }),
  // ─── Comments ────────────────────────────────────────────────────────────
  comments: router({
    list: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Verify user has access to this task
        const authorized = await isUserAuthorizedForTask(input.taskId, ctx.user.id);
        if (!authorized) throw new TRPCError({ code: "FORBIDDEN" });
        return getCommentsForTask(input.taskId);
      }),
    add: protectedProcedure
      .input(
        z.object({
          taskId: z.number(),
          content: z.string().min(1).max(2000).trim(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const authorized = await isUserAuthorizedForTask(input.taskId, ctx.user.id);
        if (!authorized) throw new TRPCError({ code: "FORBIDDEN" });
        const result = await addComment(input.taskId, ctx.user.id, input.content);
        // Log the comment activity
        await addActivityLog({
          taskId: input.taskId,
          userId: ctx.user.id,
          action: "updated",
          details: JSON.stringify({ type: "comment_added", preview: input.content.slice(0, 80) }),
        });
        return { id: result.id };
      }),
    update: protectedProcedure
      .input(
        z.object({
          commentId: z.number(),
          content: z.string().trim().min(1).max(2000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const comment = await getCommentById(input.commentId);
        if (!comment) throw new TRPCError({ code: "NOT_FOUND" });
        // Only the comment author can edit
        if (comment.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (comment.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Comment has been deleted" });
        await updateComment(input.commentId, ctx.user.id, input.content);
        // Log the comment edit activity
        await addActivityLog({
          taskId: comment.taskId,
          userId: ctx.user.id,
          action: "updated",
          details: JSON.stringify({ type: "comment_edited", preview: input.content.slice(0, 80) }),
        });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ commentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const comment = await getCommentById(input.commentId);
        if (!comment) throw new TRPCError({ code: "NOT_FOUND" });
        // Only the comment author or an admin can delete
        if (comment.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Use soft-delete to preserve the record
        await softDeleteComment(input.commentId, ctx.user.id);
        return { success: true };
      }),
  }),
});
export type AppRouter = typeof appRouter;
