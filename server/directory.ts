/**
 * server/directory.ts
 * DB helpers for the Personal Directory feature:
 *   - personal_groups
 *   - personal_group_members
 *   - directory_connections
 *   - invitations
 */

import { getDb } from "./db";
import {
  personalGroups,
  personalGroupMembers,
  directoryConnections,
  invitations,
  users,
} from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import crypto from "crypto";

// ─── Internal helper ──────────────────────────────────────────────────────────

async function db() {
  const d = await getDb();
  if (!d) throw new Error("Database not available");
  return d;
}

// ─── Default Groups ────────────────────────────────────────────────────────────

const DEFAULT_GROUPS = [
  { name: "Family", type: "system" as const, isDefault: true },
  { name: "Friends", type: "system" as const, isDefault: true },
  { name: "Work", type: "system" as const, isDefault: true },
  { name: "Personal", type: "system" as const, isDefault: true },
];

/**
 * Create the four default system groups for a newly registered user.
 * Silently skips if groups already exist (idempotent).
 */
export async function createDefaultGroups(userId: number): Promise<void> {
  const d = await db();
  for (const g of DEFAULT_GROUPS) {
    try {
      await d.insert(personalGroups).ignore().values({
        userId,
        name: g.name,
        type: g.type,
        isDefault: g.isDefault,
      });
    } catch {
      // unique constraint violation — already exists, skip
    }
  }
}

// ─── Personal Groups ───────────────────────────────────────────────────────────

export async function getGroupsForUser(userId: number) {
  const d = await db();
  return d
    .select()
    .from(personalGroups)
    .where(eq(personalGroups.userId, userId))
    .orderBy(personalGroups.isDefault, personalGroups.name);
}

export async function createGroup(userId: number, name: string): Promise<number> {
  const d = await db();
  const [result] = await d.insert(personalGroups).values({
    userId,
    name,
    type: "custom",
    isDefault: false,
  });
  return (result as { insertId: number }).insertId;
}

export async function updateGroup(
  groupId: number,
  userId: number,
  name: string
): Promise<void> {
  const d = await db();
  await d
    .update(personalGroups)
    .set({ name })
    .where(and(eq(personalGroups.id, groupId), eq(personalGroups.userId, userId)));
}

export async function deleteGroup(groupId: number, userId: number): Promise<void> {
  const d = await db();
  // Only allow deleting custom groups (not system defaults)
  const [group] = await d
    .select()
    .from(personalGroups)
    .where(
      and(
        eq(personalGroups.id, groupId),
        eq(personalGroups.userId, userId),
        eq(personalGroups.type, "custom")
      )
    );
  if (!group) throw new Error("Group not found or cannot be deleted");
  await d.delete(personalGroupMembers).where(eq(personalGroupMembers.groupId, groupId));
  await d.delete(personalGroups).where(eq(personalGroups.id, groupId));
}

// ─── Group Members ─────────────────────────────────────────────────────────────

export async function getMembersForGroup(groupId: number) {
  const d = await db();
  return d
    .select({
      id: personalGroupMembers.id,
      groupId: personalGroupMembers.groupId,
      memberId: personalGroupMembers.memberId,
      addedAt: personalGroupMembers.addedAt,
      name: users.name,
      email: users.email,
    })
    .from(personalGroupMembers)
    .innerJoin(users, eq(users.id, personalGroupMembers.memberId))
    .where(eq(personalGroupMembers.groupId, groupId));
}

export async function addMemberToGroup(
  groupId: number,
  memberId: number,
  ownerId: number
): Promise<void> {
  const d = await db();
  const [group] = await d
    .select()
    .from(personalGroups)
    .where(and(eq(personalGroups.id, groupId), eq(personalGroups.userId, ownerId)));
  if (!group) throw new Error("Group not found");
  await d.insert(personalGroupMembers).ignore().values({ groupId, memberId });
  await ensureDirectoryConnection(ownerId, memberId, "group");
}

export async function removeMemberFromGroup(groupId: number, memberId: number): Promise<void> {
  const d = await db();
  await d
    .delete(personalGroupMembers)
    .where(
      and(
        eq(personalGroupMembers.groupId, groupId),
        eq(personalGroupMembers.memberId, memberId)
      )
    );
}

// ─── Directory Connections ─────────────────────────────────────────────────────

export async function ensureDirectoryConnection(
  ownerId: number,
  contactId: number,
  source: "invite" | "manual" | "group" = "manual"
): Promise<void> {
  const d = await db();
  await d.insert(directoryConnections).ignore().values({ ownerId, contactId, source });
}

export async function getDirectoryContacts(ownerId: number) {
  const d = await db();
  return d
    .select({
      id: directoryConnections.id,
      contactId: directoryConnections.contactId,
      source: directoryConnections.source,
      nickname: directoryConnections.nickname,
      addedAt: directoryConnections.addedAt,
      name: users.name,
      email: users.email,
    })
    .from(directoryConnections)
    .innerJoin(users, eq(users.id, directoryConnections.contactId))
    .where(eq(directoryConnections.ownerId, ownerId))
    .orderBy(users.name);
}

export async function addDirectoryContact(
  ownerId: number,
  contactId: number,
  nickname?: string
): Promise<void> {
  const d = await db();
  if (ownerId === contactId) throw new Error("Cannot add yourself to directory");
  await d.insert(directoryConnections).ignore().values({
    ownerId,
    contactId,
    source: "manual",
    nickname: nickname ?? null,
  });
}

export async function removeDirectoryContact(ownerId: number, contactId: number): Promise<void> {
  const d = await db();
  await d
    .delete(directoryConnections)
    .where(
      and(
        eq(directoryConnections.ownerId, ownerId),
        eq(directoryConnections.contactId, contactId)
      )
    );
}

export async function updateContactNickname(
  ownerId: number,
  contactId: number,
  nickname: string | null
): Promise<void> {
  const d = await db();
  await d
    .update(directoryConnections)
    .set({ nickname })
    .where(
      and(
        eq(directoryConnections.ownerId, ownerId),
        eq(directoryConnections.contactId, contactId)
      )
    );
}

/**
 * Get all directory contacts with their group memberships for the given owner.
 */
export async function getDirectoryWithGroups(ownerId: number) {
  const contacts = await getDirectoryContacts(ownerId);
  if (contacts.length === 0) return [];

  const contactIds = contacts.map((c) => c.contactId);
  const groups = await getGroupsForUser(ownerId);
  const groupIds = groups.map((g) => g.id);

  const memberships =
    groupIds.length > 0
      ? await (await db())
          .select()
          .from(personalGroupMembers)
          .where(
            and(
              inArray(personalGroupMembers.groupId, groupIds),
              inArray(personalGroupMembers.memberId, contactIds)
            )
          )
      : [];

  const memberGroupMap = new Map<number, string[]>();
  for (const m of memberships) {
    const group = groups.find((g) => g.id === m.groupId);
    if (!group) continue;
    if (!memberGroupMap.has(m.memberId)) memberGroupMap.set(m.memberId, []);
    memberGroupMap.get(m.memberId)!.push(group.name);
  }

  return contacts.map((c) => ({
    ...c,
    groups: memberGroupMap.get(c.contactId) ?? [],
  }));
}

// ─── Invitations ───────────────────────────────────────────────────────────────

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createInvitation(
  inviterId: number,
  email: string | null,
  phone: string | null,
  groupId: number | null
): Promise<{ token: string; id: number }> {
  const d = await db();
  if (!email && !phone) {
    throw new Error("At least one of email or phone must be provided");
  }
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [result] = await d.insert(invitations).values({
    inviterId,
    email: email ?? null,
    phone: phone ?? null,
    groupId: groupId ?? null,
    token,
    status: "pending",
    expiresAt,
  });
  return { token, id: (result as { insertId: number }).insertId };
}

export async function getInvitationByToken(token: string) {
  const d = await db();
  const [inv] = await d
    .select()
    .from(invitations)
    .where(eq(invitations.token, token));
  return inv ?? null;
}

export async function getInvitationsForUser(inviterId: number) {
  const d = await db();
  return d
    .select()
    .from(invitations)
    .where(eq(invitations.inviterId, inviterId))
    .orderBy(invitations.createdAt);
}

export async function acceptInvitation(
  token: string,
  acceptingUserId: number
): Promise<{ inviterId: number; groupId: number | null }> {
  const d = await db();
  const inv = await getInvitationByToken(token);
  if (!inv) throw new Error("Invitation not found");
  if (inv.status !== "pending") throw new Error("Invitation is no longer valid");
  if (new Date() > inv.expiresAt) {
    await d.update(invitations).set({ status: "expired" }).where(eq(invitations.id, inv.id));
    throw new Error("Invitation has expired");
  }
  await d
    .update(invitations)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(invitations.id, inv.id));
  await ensureDirectoryConnection(inv.inviterId, acceptingUserId, "invite");
  if (inv.groupId) {
    await d.insert(personalGroupMembers).ignore().values({
      groupId: inv.groupId,
      memberId: acceptingUserId,
    });
  }
  return { inviterId: inv.inviterId, groupId: inv.groupId ?? null };
}

export async function declineInvitation(token: string): Promise<void> {
  const d = await db();
  await d
    .update(invitations)
    .set({ status: "declined" })
    .where(and(eq(invitations.token, token), eq(invitations.status, "pending")));
}
