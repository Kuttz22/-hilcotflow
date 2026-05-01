/**
 * adminDb.ts
 * ==========
 * Raw Drizzle query helpers used exclusively by the admin router.
 * All functions return plain objects — no business logic here.
 * Uses the same getDb() pattern as db.ts.
 */

import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "./db";
import { users, deviceTokens, tasks } from "../drizzle/schema";

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export async function getAdminKPIs() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    [totalUsersRow],
    [newUsersRow],
    [activeUsersRow],
    pushEnabledRows,
    [tasksCreatedRow],
    [tasksCompletedRow],
    [overdueRow],
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(users).where(gte(users.createdAt, sevenDaysAgo)),
    db.select({ count: count() }).from(users).where(gte(users.lastSignedIn, oneDayAgo)),
    db.selectDistinct({ userId: deviceTokens.userId }).from(deviceTokens),
    db.select({ count: count() }).from(tasks).where(gte(tasks.createdAt, sevenDaysAgo)),
    db
      .select({ count: count() })
      .from(tasks)
      .where(and(gte(tasks.completedAt, sevenDaysAgo), eq(tasks.status, "completed"))),
    db.select({ count: count() }).from(tasks).where(eq(tasks.status, "overdue")),
  ]);

  return {
    totalUsers: totalUsersRow?.count ?? 0,
    newUsers7d: newUsersRow?.count ?? 0,
    activeUsers24h: activeUsersRow?.count ?? 0,
    pushEnabledUsers: pushEnabledRows.length,
    tasksCreated7d: tasksCreatedRow?.count ?? 0,
    tasksCompleted7d: tasksCompletedRow?.count ?? 0,
    overdueTasks: overdueRow?.count ?? 0,
  };
}

// ─── User List ────────────────────────────────────────────────────────────────

export async function getAdminUserList() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(sql`${users.createdAt} DESC`);

  if (allUsers.length === 0) return [];

  const userIds = allUsers.map((u) => u.id);
  const tokenRows = await db
    .selectDistinct({ userId: deviceTokens.userId })
    .from(deviceTokens)
    .where(inArray(deviceTokens.userId, userIds));

  const pushEnabledSet = new Set(tokenRows.map((r) => r.userId));

  return allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    lastSignedIn: u.lastSignedIn,
    hasPush: pushEnabledSet.has(u.id),
  }));
}

// ─── Device Tokens ────────────────────────────────────────────────────────────

export async function getAdminDeviceTokens() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      id: deviceTokens.id,
      userId: deviceTokens.userId,
      token: deviceTokens.token,
      platform: deviceTokens.platform,
      apnsEnvironment: deviceTokens.apnsEnvironment,
      createdAt: deviceTokens.createdAt,
      updatedAt: deviceTokens.updatedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(deviceTokens)
    .leftJoin(users, eq(users.id, deviceTokens.userId))
    .orderBy(sql`${deviceTokens.updatedAt} DESC`);

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    platform: r.platform,
    apnsEnvironment: r.apnsEnvironment,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    userName: r.userName,
    userEmail: r.userEmail,
    // Truncate token for display — show first 16 + last 8 chars
    tokenPreview:
      r.token.length > 28
        ? `${r.token.slice(0, 16)}…${r.token.slice(-8)}`
        : r.token,
  }));
}

// ─── Daily Activity (last 30 days) ────────────────────────────────────────────

export async function getAdminDailyActivity() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [createdRows, completedRows] = await Promise.all([
    db
      .select({
        day: sql<string>`DATE(${tasks.createdAt})`,
        count: count(),
      })
      .from(tasks)
      .where(gte(tasks.createdAt, thirtyDaysAgo))
      .groupBy(sql`DATE(${tasks.createdAt})`)
      .orderBy(sql`DATE(${tasks.createdAt}) ASC`),

    db
      .select({
        day: sql<string>`DATE(${tasks.completedAt})`,
        count: count(),
      })
      .from(tasks)
      .where(and(gte(tasks.completedAt, thirtyDaysAgo), eq(tasks.status, "completed")))
      .groupBy(sql`DATE(${tasks.completedAt})`)
      .orderBy(sql`DATE(${tasks.completedAt}) ASC`),
  ]);

  return {
    created: createdRows.map((r) => ({ day: r.day, count: r.count })),
    completed: completedRows.map((r) => ({ day: r.day, count: r.count })),
  };
}

// ─── Stale Token Cleanup ─────────────────────────────────────────────────────

/**
 * Delete all device_token rows where apnsEnvironment = 'sandbox'.
 * These tokens were registered before the production-domain fix and will
 * always return BadDeviceToken when sent to the production APNs endpoint.
 * Returns the count of deleted rows.
 */
export async function deleteSandboxTokens(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .delete(deviceTokens)
    .where(eq(deviceTokens.apnsEnvironment, "sandbox"));
  // Drizzle MySQL delete returns { rowsAffected: number }
  return (result as unknown as { rowsAffected: number }).rowsAffected ?? 0;
}

// ─── First task check (for owner alert) ──────────────────────────────────────

export async function countTasksCreatedByUser(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ count: count() })
    .from(tasks)
    .where(eq(tasks.createdById, userId));
  return row?.count ?? 0;
}
