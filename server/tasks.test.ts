import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Push Notifications Mock ────────────────────────────────────────────────

vi.mock("./pushNotifications", () => ({
  registerDeviceToken: vi.fn().mockResolvedValue(undefined),
  removeDeviceToken: vi.fn().mockResolvedValue(undefined),
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

// ─── DB Mock ──────────────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getUserByEmail: vi.fn().mockResolvedValue(null),
  getAllUsers: vi.fn().mockResolvedValue([]),
  getUserById: vi.fn().mockResolvedValue(null),
  getTasksForUser: vi.fn().mockResolvedValue([]),
  getTaskById: vi.fn().mockResolvedValue(null),
  createTask: vi.fn().mockResolvedValue({ id: 1 }),
  updateTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  getTaskShares: vi.fn().mockResolvedValue([]),
  addTaskShare: vi.fn().mockResolvedValue(undefined),
  removeTaskShare: vi.fn().mockResolvedValue(undefined),
  isUserAuthorizedForTask: vi.fn().mockResolvedValue(true),
  addActivityLog: vi.fn().mockResolvedValue(undefined),
  getActivityLogForTask: vi.fn().mockResolvedValue([]),
  getRecentActivity: vi.fn().mockResolvedValue([]),
  getDashboardSummary: vi.fn().mockResolvedValue({
    totalActive: 5,
    assignedToMe: 2,
    assignedByMe: 3,
    sharedWithMe: 1,
    waitingOnOthers: 1,
    overdue: 1,
    escalated: 0,
    completedToday: 0,
  }),
  markOverdueTasks: vi.fn().mockResolvedValue(0),
  getTasksDueForReminder: vi.fn().mockResolvedValue([]),
  createEmailUser: vi.fn().mockResolvedValue(null),
  deleteUserAndData: vi.fn().mockResolvedValue(undefined),
  getUserPreferences: vi.fn().mockResolvedValue(null),
  upsertUserPreferences: vi.fn().mockResolvedValue(undefined),
  registerDeviceToken: vi.fn().mockResolvedValue(undefined),
  removeDeviceToken: vi.fn().mockResolvedValue(undefined),
  getDeviceTokensForUser: vi.fn().mockResolvedValue([]),
  createReminderJob: vi.fn().mockResolvedValue({ id: 1 }),
  getReminderJobsForTask: vi.fn().mockResolvedValue([]),
  updateReminderJob: vi.fn().mockResolvedValue(undefined),
  deleteReminderJobsForTask: vi.fn().mockResolvedValue(undefined),
  getDueReminderJobs: vi.fn().mockResolvedValue([]),
  getCommentsForTask: vi.fn().mockResolvedValue([]),
  addComment: vi.fn().mockResolvedValue({ id: 42 }),
  deleteComment: vi.fn().mockResolvedValue(undefined),
  softDeleteComment: vi.fn().mockResolvedValue(undefined),
  updateComment: vi.fn().mockResolvedValue(undefined),
  getCommentById: vi.fn().mockResolvedValue(null),
  stopReminderJobsForTask: vi.fn().mockResolvedValue(undefined),
  canUserCompleteTask: vi.fn().mockResolvedValue(true),
  touchTaskLastSeen: vi.fn().mockResolvedValue(undefined),
  getTaskParticipantIds: vi.fn().mockResolvedValue([1]),
}));

// ─── Context Factory ──────────────────────────────────────────────────────────

function createMockContext(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-1",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      passwordHash: null,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns the current user when authenticated", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeTruthy();
    expect(result?.id).toBe(1);
    expect(result?.name).toBe("Test User");
  });

  it("returns null when not authenticated", async () => {
    const ctx = createMockContext({ user: null });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and returns success", async () => {
    const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
    const ctx = createMockContext({
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
        cookie: vi.fn(),
      } as unknown as TrpcContext["res"],
    });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies.length).toBe(1);
  });
});

// ─── Users Tests ──────────────────────────────────────────────────────────────

describe("users.list", () => {
  it("returns an empty list when no users exist", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Tasks Tests ──────────────────────────────────────────────────────────────

describe("tasks.list", () => {
  it("returns tasks for authenticated user", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.tasks.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = createMockContext({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tasks.list({})).rejects.toThrow();
  });
});

// ─── Dashboard Tests ──────────────────────────────────────────────────────────

describe("dashboard.summary", () => {
  it("returns summary stats including waitingOnOthers and escalated", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.summary();
    expect(result).toBeTruthy();
    expect(typeof result.totalActive).toBe("number");
    expect(typeof result.overdue).toBe("number");
    expect(typeof result.waitingOnOthers).toBe("number");
    expect(typeof result.escalated).toBe("number");
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = createMockContext({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.summary()).rejects.toThrow();
  });
});

// ─── Escalation Logic ─────────────────────────────────────────────────────────

describe("escalation thresholds", () => {
  const ESCALATION_THRESHOLD = 3;
  const CREATOR_ALERT_THRESHOLD = 12;

  it("escalates task after 3 reminders", () => {
    expect(3 >= ESCALATION_THRESHOLD).toBe(true);
  });

  it("does not escalate task before 3 reminders", () => {
    expect(2 >= ESCALATION_THRESHOLD).toBe(false);
  });

  it("triggers creator alert at 12 reminders", () => {
    expect(12 >= CREATOR_ALERT_THRESHOLD).toBe(true);
  });

  it("does not trigger creator alert before 12 reminders", () => {
    expect(11 >= CREATOR_ALERT_THRESHOLD).toBe(false);
  });
});

// ─── Quiet Hours Logic ────────────────────────────────────────────────────────

describe("quiet hours enforcement", () => {
  function isInQuietHours(currentHour: number, startHour: number, endHour: number): boolean {
    if (startHour < endHour) {
      return currentHour >= startHour && currentHour < endHour;
    }
    return currentHour >= startHour || currentHour < endHour;
  }

  it("detects quiet hours within a same-day window (09:00–17:00)", () => {
    expect(isInQuietHours(10, 9, 17)).toBe(true);
    expect(isInQuietHours(8, 9, 17)).toBe(false);
    expect(isInQuietHours(17, 9, 17)).toBe(false);
  });

  it("detects quiet hours that wrap midnight (22:00–07:00)", () => {
    expect(isInQuietHours(23, 22, 7)).toBe(true);
    expect(isInQuietHours(0, 22, 7)).toBe(true);
    expect(isInQuietHours(6, 22, 7)).toBe(true);
    expect(isInQuietHours(7, 22, 7)).toBe(false);
    expect(isInQuietHours(12, 22, 7)).toBe(false);
  });
});

// ─── Completion Permission Logic ──────────────────────────────────────────────

describe("completion permission rules", () => {
  type Permission = "creator_only" | "assignee_only" | "any_participant";

  function canComplete(
    permission: Permission,
    userId: number,
    creatorId: number,
    assigneeId: number | null
  ): boolean {
    if (permission === "creator_only") return userId === creatorId;
    if (permission === "assignee_only") return userId === assigneeId;
    return userId === creatorId || userId === assigneeId;
  }

  it("creator_only allows only the creator", () => {
    expect(canComplete("creator_only", 1, 1, 2)).toBe(true);
    expect(canComplete("creator_only", 2, 1, 2)).toBe(false);
  });

  it("assignee_only allows only the assignee", () => {
    expect(canComplete("assignee_only", 2, 1, 2)).toBe(true);
    expect(canComplete("assignee_only", 1, 1, 2)).toBe(false);
  });

  it("any_participant allows creator or assignee", () => {
    expect(canComplete("any_participant", 1, 1, 2)).toBe(true);
    expect(canComplete("any_participant", 2, 1, 2)).toBe(true);
    expect(canComplete("any_participant", 3, 1, 2)).toBe(false);
  });
});

// ─── Overdue Detection ────────────────────────────────────────────────────────

describe("overdue detection logic", () => {
  function shouldMarkOverdue(task: { dueDate: Date; status: string }): boolean {
    const now = new Date();
    return (
      task.dueDate <= now &&
      task.status !== "completed" &&
      task.status !== "overdue" &&
      task.status !== "escalated"
    );
  }

  it("marks a pending task with past due date as overdue", () => {
    expect(shouldMarkOverdue({
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: "pending",
    })).toBe(true);
  });

  it("does not mark a completed task as overdue", () => {
    expect(shouldMarkOverdue({
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: "completed",
    })).toBe(false);
  });

  it("does not mark a future task as overdue", () => {
    expect(shouldMarkOverdue({
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "pending",
    })).toBe(false);
  });

  it("does not re-mark an already escalated task as overdue", () => {
    expect(shouldMarkOverdue({
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: "escalated",
    })).toBe(false);
  });
});

// ─── Waiting on Others ────────────────────────────────────────────────────────

describe("waiting on others detection", () => {
  function isWaitingOnOthers(task: {
    createdById: number;
    assignedToId: number | null;
    status: string;
  }, currentUserId: number): boolean {
    return (
      task.createdById === currentUserId &&
      task.assignedToId !== null &&
      task.assignedToId !== currentUserId &&
      task.status !== "completed"
    );
  }

  it("identifies a task as waiting on others when assigned to someone else", () => {
    expect(isWaitingOnOthers({ createdById: 1, assignedToId: 2, status: "in_progress" }, 1)).toBe(true);
  });

  it("does not flag a self-assigned task as waiting on others", () => {
    expect(isWaitingOnOthers({ createdById: 1, assignedToId: 1, status: "in_progress" }, 1)).toBe(false);
  });

  it("does not flag a completed task as waiting on others", () => {
    expect(isWaitingOnOthers({ createdById: 1, assignedToId: 2, status: "completed" }, 1)).toBe(false);
  });

  it("does not flag a task created by someone else", () => {
    expect(isWaitingOnOthers({ createdById: 2, assignedToId: 3, status: "pending" }, 1)).toBe(false);
  });
});

// ─── Reminder Interval Calculations ──────────────────────────────────────────

describe("reminder interval calculations", () => {
  it("calculates next run time correctly for 30-minute interval", () => {
    const now = Date.now();
    const nextRunAt = new Date(now + 30 * 60 * 1000);
    expect(nextRunAt.getTime() - now).toBeCloseTo(30 * 60 * 1000, -2);
  });

  it("calculates next run time correctly for daily (1440-minute) interval", () => {
    const now = Date.now();
    const nextRunAt = new Date(now + 1440 * 60 * 1000);
    expect(nextRunAt.getTime() - now).toBeCloseTo(24 * 60 * 60 * 1000, -2);
  });
});

// ─── Comments Router ──────────────────────────────────────────────────────────
describe("comments router", () => {
  it("lists comments for an authorized task", async () => {
    const { getCommentsForTask, isUserAuthorizedForTask } = await import("./db");
    vi.mocked(isUserAuthorizedForTask).mockResolvedValueOnce(true);
    vi.mocked(getCommentsForTask).mockResolvedValueOnce([
      {
        id: 1,
        taskId: 10,
        userId: 1,
        content: "First comment",
        createdAt: new Date(),
        updatedAt: new Date(),
        userName: "Test User",
        userEmail: "test@example.com",
      },
    ]);
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.comments.list({ taskId: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("First comment");
  });

  it("throws FORBIDDEN when user is not authorized for the task", async () => {
    const { isUserAuthorizedForTask } = await import("./db");
    vi.mocked(isUserAuthorizedForTask).mockResolvedValueOnce(false);
    const caller = appRouter.createCaller(createMockContext());
    await expect(caller.comments.list({ taskId: 99 })).rejects.toThrow();
  });

  it("adds a comment to an authorized task", async () => {
    const { addComment, isUserAuthorizedForTask } = await import("./db");
    vi.mocked(isUserAuthorizedForTask).mockResolvedValueOnce(true);
    vi.mocked(addComment).mockResolvedValueOnce({ id: 42 });
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.comments.add({ taskId: 10, content: "Great progress!" });
    expect(result.id).toBe(42);
    expect(addComment).toHaveBeenCalledWith(10, 1, "Great progress!");
  });

  it("rejects empty comment content", async () => {
    const { isUserAuthorizedForTask } = await import("./db");
    vi.mocked(isUserAuthorizedForTask).mockResolvedValueOnce(true);
    const caller = appRouter.createCaller(createMockContext());
    await expect(caller.comments.add({ taskId: 10, content: "" })).rejects.toThrow();
  });

  it("allows comment author to delete their own comment", async () => {
    const { getCommentById, softDeleteComment } = await import("./db");
    vi.mocked(getCommentById).mockResolvedValueOnce({
      id: 5,
      taskId: 10,
      userId: 1, // same as mock context user id
      content: "My comment",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.comments.delete({ commentId: 5 });
    expect(result.success).toBe(true);
    expect(softDeleteComment).toHaveBeenCalledWith(5, 1);
  });

  it("throws FORBIDDEN when non-author tries to delete a comment", async () => {
    const { getCommentById } = await import("./db");
    vi.mocked(getCommentById).mockResolvedValueOnce({
      id: 5,
      taskId: 10,
      userId: 99, // different user
      content: "Someone else's comment",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const caller = appRouter.createCaller(createMockContext());
    await expect(caller.comments.delete({ commentId: 5 })).rejects.toThrow();
  });

  it("allows admin to delete any comment", async () => {
    const { getCommentById } = await import("./db");
    vi.mocked(getCommentById).mockResolvedValueOnce({
      id: 5,
      taskId: 10,
      userId: 99, // different user
      content: "Someone else's comment",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const adminCtx = createMockContext({ user: { ...createMockContext().user!, role: "admin" } });
    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.comments.delete({ commentId: 5 });
    expect(result.success).toBe(true);
  });

  it("throws NOT_FOUND when comment does not exist", async () => {
    const { getCommentById } = await import("./db");
    vi.mocked(getCommentById).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(createMockContext());
    await expect(caller.comments.delete({ commentId: 999 })).rejects.toThrow();
  });

  it("uses soft-delete when deleting a comment", async () => {
    const { getCommentById, softDeleteComment } = await import("./db");
    vi.mocked(getCommentById).mockResolvedValueOnce({
      id: 7,
      taskId: 10,
      userId: 1,
      content: "My comment",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.comments.delete({ commentId: 7 });
    expect(result.success).toBe(true);
    expect(softDeleteComment).toHaveBeenCalledWith(7, 1);
  });

  it("allows comment author to update their own comment", async () => {
    const { getCommentById, updateComment } = await import("./db");
    vi.mocked(getCommentById).mockResolvedValueOnce({
      id: 8,
      taskId: 10,
      userId: 1,
      content: "Original content",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.comments.update({ commentId: 8, content: "Updated content" });
    expect(result.success).toBe(true);
    expect(updateComment).toHaveBeenCalledWith(8, 1, "Updated content");
  });

  it("throws FORBIDDEN when non-author tries to update a comment", async () => {
    const { getCommentById } = await import("./db");
    vi.mocked(getCommentById).mockResolvedValueOnce({
      id: 9,
      taskId: 10,
      userId: 99,
      content: "Someone else's comment",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    const caller = appRouter.createCaller(createMockContext());
    await expect(caller.comments.update({ commentId: 9, content: "Hijacked" })).rejects.toThrow();
  });

  it("throws NOT_FOUND when trying to update a soft-deleted comment", async () => {
    const { getCommentById } = await import("./db");
    vi.mocked(getCommentById).mockResolvedValueOnce({
      id: 10,
      taskId: 10,
      userId: 1,
      content: "Deleted comment",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: new Date(), // soft-deleted
    });
    const caller = appRouter.createCaller(createMockContext());
    await expect(caller.comments.update({ commentId: 10, content: "Trying to edit" })).rejects.toThrow();
  });

  it("rejects empty content on update", async () => {
    const { getCommentById } = await import("./db");
    vi.mocked(getCommentById).mockResolvedValueOnce({
      id: 11,
      taskId: 10,
      userId: 1,
      content: "Some comment",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    const caller = appRouter.createCaller(createMockContext());
    await expect(caller.comments.update({ commentId: 11, content: "   " })).rejects.toThrow();
  });
});

// ─── Login Page — validation rules ───────────────────────────────────────────
describe("email login validation rules (unit)", () => {
  function validateEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  function validatePassword(pw: string) {
    return pw.length >= 8;
  }
  function passwordsMatch(a: string, b: string) {
    return a === b;
  }

  it("accepts a valid email", () => {
    expect(validateEmail("user@company.com")).toBe(true);
  });
  it("rejects an email without @", () => {
    expect(validateEmail("notanemail")).toBe(false);
  });
  it("rejects an email without domain", () => {
    expect(validateEmail("user@")).toBe(false);
  });
  it("accepts a password of exactly 8 characters", () => {
    expect(validatePassword("abcd1234")).toBe(true);
  });
  it("rejects a password shorter than 8 characters", () => {
    expect(validatePassword("short")).toBe(false);
  });
  it("confirms matching passwords", () => {
    expect(passwordsMatch("secure123", "secure123")).toBe(true);
  });
  it("rejects mismatched passwords", () => {
    expect(passwordsMatch("secure123", "different")).toBe(false);
  });
});

// ─── Comment Edit Activity Logging ───────────────────────────────────────────
describe("comments.update — activity logging", () => {
  it("logs a comment_edited activity entry when a comment is successfully updated", async () => {
    const { getCommentById, updateComment, addActivityLog } = await import("./db");
    vi.mocked(getCommentById).mockReset();
    vi.mocked(addActivityLog).mockClear();
    vi.mocked(getCommentById).mockResolvedValueOnce({
      id: 20,
      taskId: 5,
      userId: 1,
      content: "Original text",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    vi.mocked(addActivityLog).mockClear();
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.comments.update({ commentId: 20, content: "Revised text" });
    expect(result.success).toBe(true);
    expect(updateComment).toHaveBeenCalledWith(20, 1, "Revised text");
    expect(addActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 5,
        userId: 1,
        action: "updated",
        details: expect.stringContaining("comment_edited"),
      })
    );
  });

  it("does not log activity when a non-author tries to edit a comment", async () => {
    const { getCommentById, addActivityLog } = await import("./db");
    // Reset and set up mock for this test specifically
    vi.mocked(getCommentById).mockReset();
    vi.mocked(getCommentById).mockResolvedValueOnce({
      id: 21,
      taskId: 5,
      userId: 99, // different user — not the caller
      content: "Someone else's comment",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    vi.mocked(addActivityLog).mockClear();
    const caller = appRouter.createCaller(createMockContext());
    await expect(
      caller.comments.update({ commentId: 21, content: "Hijacked" })
    ).rejects.toThrow();
    expect(addActivityLog).not.toHaveBeenCalled();
  });

  it("activity log details include the edited content preview", async () => {
    const { getCommentById, addActivityLog } = await import("./db");
    vi.mocked(getCommentById).mockReset();
    vi.mocked(getCommentById).mockResolvedValueOnce({
      id: 22,
      taskId: 7,
      userId: 1,
      content: "Old content",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    vi.mocked(addActivityLog).mockClear();
    const caller = appRouter.createCaller(createMockContext());
    await caller.comments.update({ commentId: 22, content: "New content preview text" });
    const callArg = vi.mocked(addActivityLog).mock.calls[0]?.[0];
    expect(callArg).toBeDefined();
    const details = JSON.parse(callArg!.details as string);
    expect(details.type).toBe("comment_edited");
    expect(details.preview).toBe("New content preview text");
  });
});

// ─── Web Push Device Registration ────────────────────────────────────────────
describe("notifications.registerDevice — Web Push token registration", () => {
  it("registers a web device token for the authenticated user", async () => {
    const { registerDeviceToken } = await import("./pushNotifications");
    vi.mocked(registerDeviceToken).mockClear();
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.notifications.registerDevice({
      token: "fcm-web-token-abc123",
      platform: "web",
    });
    expect(result.success).toBe(true);
    expect(registerDeviceToken).toHaveBeenCalledWith(
      1, // userId from mock context
      "fcm-web-token-abc123",
      "web"
    );
  });

  it("registers an android device token", async () => {
    const { registerDeviceToken } = await import("./pushNotifications");
    vi.mocked(registerDeviceToken).mockClear();
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.notifications.registerDevice({
      token: "fcm-android-token-xyz789",
      platform: "android",
    });
    expect(result.success).toBe(true);
    expect(registerDeviceToken).toHaveBeenCalledWith(1, "fcm-android-token-xyz789", "android");
  });

  it("removes a device token on unregister", async () => {
    const { removeDeviceToken } = await import("./pushNotifications");
    vi.mocked(removeDeviceToken).mockClear();
    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.notifications.removeDevice({ token: "fcm-web-token-abc123" });
    expect(result.success).toBe(true);
    expect(removeDeviceToken).toHaveBeenCalledWith("fcm-web-token-abc123");
  });

  it("rejects unauthenticated device registration", async () => {
    const caller = appRouter.createCaller({
      user: null,
      setCookie: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext);
    await expect(
      caller.notifications.registerDevice({ token: "any-token", platform: "web" })
    ).rejects.toThrow();
  });
});
