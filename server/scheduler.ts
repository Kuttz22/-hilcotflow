/**
 * Background Scheduler
 *
 * Runs every 60 seconds and handles:
 *  1. Mark overdue tasks (sets status = 'overdue', isOverdue = true)
 *  2. Process reminder_jobs table — deliver push notifications to all participants
 *  3. Escalation logic:
 *       - reminderCount >= 3  → status = 'escalated', activity log entry
 *       - reminderCount >= 12 → alert creator via push notification
 *  4. Quiet hours enforcement — skip delivery if recipient is in quiet hours
 *  5. Max reminders per day enforcement
 *  6. Stop reminder jobs automatically when task is completed
 */

import {
  addActivityLog,
  getDueReminderJobs,
  getTaskById,
  getUserPreferences,
  markOverdueTasks,
  stopReminderJobsForTask,
  updateReminderJobAfterRun,
  updateTask,
  getTaskParticipantIds,
} from "./db";
import { sendPushToUsers } from "./pushNotifications";

// ─── Quiet Hours Check ────────────────────────────────────────────────────────

async function isInQuietHours(userId: number): Promise<boolean> {
  try {
    const prefs = await getUserPreferences(userId);
    if (!prefs?.quietHoursStart || !prefs?.quietHoursEnd) return false;
    const now = new Date();
    const [startH, startM] = prefs.quietHoursStart.split(":").map(Number);
    const [endH, endM] = prefs.quietHoursEnd.split(":").map(Number);
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    // Handle overnight quiet hours (e.g., 22:00 → 07:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch {
    return false;
  }
}

// ─── Max Reminders Per Day Check ──────────────────────────────────────────────

const dailyReminderCounts = new Map<string, number>();

function getDailyKey(userId: number): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${userId}_${today}`;
}

async function hasExceededDailyLimit(userId: number): Promise<boolean> {
  try {
    const prefs = await getUserPreferences(userId);
    const max = prefs?.maxRemindersPerDay ?? 10;
    const key = getDailyKey(userId);
    const current = dailyReminderCounts.get(key) ?? 0;
    return current >= max;
  } catch {
    return false;
  }
}

function incrementDailyCount(userId: number) {
  const key = getDailyKey(userId);
  dailyReminderCounts.set(key, (dailyReminderCounts.get(key) ?? 0) + 1);
}

// ─── Reminder Processing ──────────────────────────────────────────────────────

async function processReminderJobs() {
  try {
    const dueJobs = await getDueReminderJobs();
    if (dueJobs.length === 0) return;

    console.info(`[Scheduler] Processing ${dueJobs.length} due reminder job(s)`);

    for (const job of dueJobs) {
      try {
        const task = await getTaskById(job.taskId);
        if (!task) {
          await stopReminderJobsForTask(job.taskId);
          continue;
        }

        // Stop reminders if task is completed
        if (task.status === "completed") {
          await stopReminderJobsForTask(job.taskId);
          continue;
        }

        const newCount = job.reminderCount + 1;
        let recipientIds: number[] = [];

        try {
          recipientIds = JSON.parse(job.recipients) as number[];
        } catch {
          recipientIds = await getTaskParticipantIds(job.taskId);
        }

        // Filter out recipients in quiet hours or over daily limit
        const eligibleRecipients: number[] = [];
        for (const uid of recipientIds) {
          const quiet = await isInQuietHours(uid);
          const exceeded = await hasExceededDailyLimit(uid);
          if (!quiet && !exceeded) {
            eligibleRecipients.push(uid);
          }
        }

        // Send push notification to eligible recipients
        if (eligibleRecipients.length > 0) {
          const priorityLabel =
            task.priority === "critical"
              ? "CRITICAL"
              : task.priority === "priority"
              ? "Priority"
              : "Task";

          let body = `"${task.title}" requires your attention.`;
          if (task.dueDate) {
            const due = new Date(task.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            body += ` Due: ${due}.`;
          }
          if (newCount >= 3) {
            body += ` (Reminder #${newCount} — task has been escalated)`;
          }

          await sendPushToUsers(eligibleRecipients, {
            title: `${priorityLabel} Reminder: ${task.title}`,
            body,
            taskId: job.taskId,
            data: { reminderCount: String(newCount) },
          });

          eligibleRecipients.forEach(incrementDailyCount);

          await addActivityLog({
            taskId: job.taskId,
            userId: job.createdById,
            action: "reminder_sent",
            details: JSON.stringify({
              reminderCount: newCount,
              recipients: eligibleRecipients,
              intervalMinutes: job.intervalMinutes,
            }),
          });
        }

        // ─── Escalation Logic ──────────────────────────────────────────────

        // After 3 reminders → escalate the task
        const taskStatusStr = task.status as string;
        if (newCount === 3 && taskStatusStr !== "escalated" && taskStatusStr !== "completed") {
          await updateTask(job.taskId, { status: "escalated" });
          await addActivityLog({
            taskId: job.taskId,
            userId: job.createdById,
            action: "escalated",
            details: JSON.stringify({
              reason: "3 reminders sent without completion",
              reminderCount: newCount,
            }),
          });
          console.info(`[Scheduler] Task ${job.taskId} escalated after ${newCount} reminders`);
        }

        // After 12 reminders → alert the creator directly
        if (newCount === 12) {
          await sendPushToUsers([task.createdById], {
            title: `Escalation Alert: "${task.title}"`,
            body: `This task has received ${newCount} reminders without being completed. Immediate attention required.`,
            taskId: job.taskId,
            data: { escalationLevel: "critical" },
          });
          await addActivityLog({
            taskId: job.taskId,
            userId: job.createdById,
            action: "escalation_alert",
            details: JSON.stringify({
              reminderCount: newCount,
              message: "Creator alerted after 12 reminders",
            }),
          });
          console.warn(`[Scheduler] Escalation alert sent for task ${job.taskId} (${newCount} reminders)`);
        }

        await updateReminderJobAfterRun(job.id, job.intervalMinutes, newCount);
      } catch (jobErr) {
        console.error(`[Scheduler] Error processing reminder job ${job.id}:`, jobErr);
      }
    }
  } catch (err) {
    console.error("[Scheduler] Error in reminder processing:", err);
  }
}

// ─── Overdue Processing ───────────────────────────────────────────────────────

async function processOverdueTasks() {
  try {
    const count = await markOverdueTasks();
    if (count > 0) {
      console.info(`[Scheduler] Marked ${count} task(s) as overdue`);
    }
  } catch (err) {
    console.error("[Scheduler] Error in overdue processing:", err);
  }
}

// ─── Scheduler Entry ──────────────────────────────────────────────────────────

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startScheduler() {
  if (schedulerInterval) return;
  console.info("[Scheduler] Starting background scheduler (60s interval)");

  // Run immediately on startup
  processOverdueTasks();
  processReminderJobs();

  schedulerInterval = setInterval(async () => {
    await processOverdueTasks();
    await processReminderJobs();
  }, 60 * 1000);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.info("[Scheduler] Stopped");
  }
}
