/**
 * workspace.ts
 *
 * DB helpers for the Workspace / Organisation system.
 * All functions return raw Drizzle rows; business logic lives in routers.ts.
 * Uses the shared getDb() connection pool from ./db.
 */

import { and, eq, ne } from "drizzle-orm";
import {
  workspaces,
  workspaceMembers,
  workspaceInvitations,
  users,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceInvitation,
} from "../drizzle/schema";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

// ─── Slug helpers ─────────────────────────────────────────────────────────────

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 48 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ─── Workspace CRUD ───────────────────────────────────────────────────────────

/**
 * Called as: createWorkspace({ name, description?, ownerId })
 */
export async function createWorkspace(input: {
  name: string;
  description?: string;
  ownerId: number;
}): Promise<{ id: number; slug: string }> {
  const db = await requireDb();
  const baseSlug = slugify(input.name);

  // Ensure slug uniqueness by appending a short random suffix if needed
  let slug = baseSlug;
  const existing = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, slug));
  if (existing.length > 0) {
    slug = `${baseSlug}-${Math.floor(Math.random() * 9000 + 1000)}`;
  }

  const result = await db.insert(workspaces).values({
    name: input.name,
    slug,
    description: input.description ?? null,
    ownerId: input.ownerId,
  });

  const workspaceId = (result as unknown as [{ insertId: number }])[0].insertId;

  // Add the owner as an admin member
  await db.insert(workspaceMembers).values({
    workspaceId,
    userId: input.ownerId,
    role: "admin",
    invitedById: null,
  });

  return { id: workspaceId, slug };
}

export async function getWorkspaceById(id: number): Promise<Workspace | null> {
  const db = await requireDb();
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, id));
  return rows[0] ?? null;
}

export async function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  const db = await requireDb();
  const rows = await db.select().from(workspaces).where(eq(workspaces.slug, slug));
  return rows[0] ?? null;
}

export async function getWorkspacesForUser(userId: number) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId));
  return rows;
}

/**
 * Called as: updateWorkspace(id, { name?, description? })
 */
export async function updateWorkspace(
  workspaceId: number,
  updates: { name?: string; description?: string }
): Promise<void> {
  const db = await requireDb();
  await db
    .update(workspaces)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));
}

export async function deleteWorkspace(workspaceId: number, ownerId: number): Promise<void> {
  const db = await requireDb();
  const ws = await getWorkspaceById(workspaceId);
  if (!ws || ws.ownerId !== ownerId) {
    throw new Error("Only the workspace owner can delete this workspace");
  }
  await db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
  await db.delete(workspaceInvitations).where(eq(workspaceInvitations.workspaceId, workspaceId));
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
}

// ─── Membership ───────────────────────────────────────────────────────────────

export async function getMembersForWorkspace(workspaceId: number) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      invitedById: workspaceMembers.invitedById,
      joinedAt: workspaceMembers.joinedAt,
      name: users.name,
      email: users.email,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId));
  return rows;
}

export async function getMembershipForUser(
  workspaceId: number,
  userId: number
): Promise<WorkspaceMember | null> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
  return rows[0] ?? null;
}

export async function updateMemberRole(
  workspaceId: number,
  targetUserId: number,
  newRole: "admin" | "member" | "viewer"
): Promise<void> {
  const db = await requireDb();
  await db
    .update(workspaceMembers)
    .set({ role: newRole, updatedAt: new Date() })
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId)
      )
    );
}

export async function removeMember(workspaceId: number, targetUserId: number): Promise<void> {
  const db = await requireDb();
  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId)
      )
    );
}

export async function leaveWorkspace(workspaceId: number, userId: number): Promise<void> {
  const ws = await getWorkspaceById(workspaceId);
  if (ws?.ownerId === userId) {
    throw new Error("The workspace owner cannot leave. Transfer ownership or delete the workspace.");
  }
  await removeMember(workspaceId, userId);
}

// ─── Workspace Invitations ────────────────────────────────────────────────────

/**
 * Called as: createWorkspaceInvitation({ workspaceId, invitedById, email?, role })
 * email is optional — link-based invites omit it.
 */
export async function createWorkspaceInvitation(input: {
  workspaceId: number;
  invitedById: number;
  email?: string | null;
  role: "admin" | "member" | "viewer";
}): Promise<{ token: string }> {
  const db = await requireDb();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(workspaceInvitations).values({
    workspaceId: input.workspaceId,
    invitedById: input.invitedById,
    email: input.email ?? null,
    role: input.role,
    token,
    expiresAt,
  });

  return { token };
}

export async function getWorkspaceInvitationByToken(
  token: string
): Promise<WorkspaceInvitation | null> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(workspaceInvitations)
    .where(eq(workspaceInvitations.token, token));
  return rows[0] ?? null;
}

export async function getWorkspaceInvitationsForWorkspace(workspaceId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(workspaceInvitations)
    .where(eq(workspaceInvitations.workspaceId, workspaceId));
}

export async function acceptWorkspaceInvitation(token: string, userId: number): Promise<void> {
  const db = await requireDb();
  const inv = await getWorkspaceInvitationByToken(token);
  if (!inv) throw new Error("Invitation not found");
  if (inv.status !== "pending") throw new Error("Invitation is no longer pending");
  if (inv.expiresAt < new Date()) throw new Error("Invitation has expired");

  const existing = await getMembershipForUser(inv.workspaceId, userId);
  if (!existing) {
    await db.insert(workspaceMembers).values({
      workspaceId: inv.workspaceId,
      userId,
      role: inv.role,
      invitedById: inv.invitedById,
    });
  }

  await db
    .update(workspaceInvitations)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(workspaceInvitations.token, token));
}

export async function declineWorkspaceInvitation(token: string): Promise<void> {
  const db = await requireDb();
  await db
    .update(workspaceInvitations)
    .set({ status: "declined" })
    .where(eq(workspaceInvitations.token, token));
}

// ─── Role helpers for task permission enforcement ────────────────────────────

/**
 * Returns the workspace role of a user for the workspace a task belongs to.
 * Returns null if the task has no workspaceId or the user is not a member.
 */
export async function getWorkspaceRoleForTask(
  taskId: number,
  userId: number
): Promise<"admin" | "member" | "viewer" | null> {
  const db = await requireDb();
  // Import tasks table inline to avoid circular deps
  const { tasks } = await import("../drizzle/schema");
  const taskRows = await db.select({ workspaceId: tasks.workspaceId }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
  const task = taskRows[0];
  if (!task || !task.workspaceId) return null; // personal task — no workspace role
  const membership = await getMembershipForUser(task.workspaceId, userId);
  return membership?.role ?? null;
}

// ─── People-picker: assignable workspace members ──────────────────────────────

/**
 * Returns all non-viewer members of the workspace for use in the task
 * assignment selector. Workspace visibility stays within the workspace —
 * no directory_connections rows are written automatically.
 */
export async function getAssignableMembersForWorkspace(workspaceId: number) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        ne(workspaceMembers.role, "viewer")
      )
    );
  return rows;
}
