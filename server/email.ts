/**
 * Hilcot TaskFlow — Transactional Email Service
 *
 * Sends branded emails via Resend from notifications@hilcotflow.com.
 * All emails use the Hilcot brand identity: dark navy header, Hilcot logo,
 * clean white body, and a minimal footer with no third-party branding.
 */

import { Resend } from "resend";

// ─── Constants ────────────────────────────────────────────────────────────────

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663037252870/d74AX4oW8Fw8vpX3zNznBB/hilcot-logo-512_e544432c.jpg";

const FROM_ADDRESS = "Hilcot TaskFlow <notifications@hilcotflow.com>";

const BRAND_NAVY = "#0f172a";
const BRAND_BLUE = "#2563eb";
const BRAND_LIGHT_BLUE = "#3b82f6";

// ─── Resend Client ────────────────────────────────────────────────────────────

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY not set — email sending disabled");
    return null;
  }
  return new Resend(apiKey);
}

// ─── HTML Template ────────────────────────────────────────────────────────────

function buildEmailHtml(opts: {
  title: string;
  preheader: string;
  bodyHtml: string;
}): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${opts.title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    table { border-collapse: collapse; }
    img { border: 0; display: block; }
    a { color: ${BRAND_BLUE}; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .preheader { display: none; max-height: 0; overflow: hidden; mso-hide: all; }
  </style>
</head>
<body>
  <!-- Preheader -->
  <div class="preheader">${opts.preheader}</div>

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Card -->
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:${BRAND_NAVY}; padding: 28px 40px; text-align:left;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${LOGO_URL}" alt="Hilcot" width="44" height="44" style="border-radius:8px; display:inline-block;" />
                  </td>
                  <td style="vertical-align:middle; padding-left:14px;">
                    <span style="color:#ffffff; font-size:20px; font-weight:700; letter-spacing:-0.3px;">Hilcot TaskFlow</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 40px 28px;">
              ${opts.bodyHtml}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border:none; border-top:1px solid #e2e8f0; margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; text-align:center;">
              <p style="margin:0; font-size:13px; color:#94a3b8; line-height:1.6;">
                You are receiving this email because you have an active account with Hilcot TaskFlow.<br />
                &copy; ${year} Hilcot TaskFlow. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Email Types ──────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  /** Pre-header text shown in inbox preview */
  preheader?: string;
  /** HTML body content (injected inside the branded card) */
  bodyHtml: string;
  /** Optional plain-text fallback */
  text?: string;
  /** Optional reply-to address */
  replyTo?: string;
}

// ─── Core Send ────────────────────────────────────────────────────────────────

/**
 * Send a branded transactional email via Resend.
 * Returns true on success, false on failure (non-fatal — callers should log but not crash).
 */
export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) return false;

  const html = buildEmailHtml({
    title: opts.subject,
    preheader: opts.preheader ?? opts.subject,
    bodyHtml: opts.bodyHtml,
  });

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html,
      text: opts.text,
      replyTo: opts.replyTo,
    });

    if (error) {
      console.warn("[Email] Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[Email] Failed to send email:", err);
    return false;
  }
}

// ─── Pre-built Email Templates ────────────────────────────────────────────────

/**
 * Task reminder email — sent when a reminder job fires and no push tokens are registered.
 */
export async function sendTaskReminderEmail(opts: {
  to: string;
  recipientName: string;
  taskTitle: string;
  taskId: number;
  priority: string;
  dueDate?: Date | null;
  appUrl?: string;
}): Promise<boolean> {
  const appUrl = opts.appUrl ?? "https://hilcotflow.com";
  const taskUrl = `${appUrl}/tasks/${opts.taskId}`;
  const dueDateStr = opts.dueDate
    ? `<p style="margin:0 0 12px; font-size:14px; color:#64748b;">Due: <strong>${new Date(opts.dueDate).toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong></p>`
    : "";

  const priorityColor: Record<string, string> = {
    urgent: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#22c55e",
  };
  const pColor = priorityColor[opts.priority?.toLowerCase()] ?? BRAND_BLUE;

  return sendEmail({
    to: opts.to,
    subject: `Reminder: ${opts.taskTitle}`,
    preheader: `Your task "${opts.taskTitle}" is waiting for attention.`,
    bodyHtml: `
      <h1 style="margin:0 0 8px; font-size:22px; font-weight:700; color:#0f172a;">Task Reminder</h1>
      <p style="margin:0 0 24px; font-size:15px; color:#475569;">Hi ${opts.recipientName}, this is a reminder about a task that needs your attention.</p>

      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 6px; font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.8px;">Task</p>
            <p style="margin:0 0 16px; font-size:17px; font-weight:600; color:#0f172a;">${opts.taskTitle}</p>
            ${dueDateStr}
            <p style="margin:0; font-size:14px; color:#64748b;">Priority: <span style="display:inline-block; padding:2px 10px; border-radius:20px; background:${pColor}20; color:${pColor}; font-weight:600; font-size:13px;">${opts.priority ?? "Normal"}</span></p>
          </td>
        </tr>
      </table>

      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="border-radius:8px; background:${BRAND_BLUE};">
            <a href="${taskUrl}" style="display:inline-block; padding:12px 28px; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; border-radius:8px;">View Task →</a>
          </td>
        </tr>
      </table>
    `,
    text: `Task Reminder: ${opts.taskTitle}\n\nHi ${opts.recipientName},\n\nThis is a reminder about a task that needs your attention.\n\nTask: ${opts.taskTitle}\nPriority: ${opts.priority ?? "Normal"}\n\nView task: ${taskUrl}`,
  });
}

/**
 * Task escalation email — sent when a task has been reminded 3+ times without resolution.
 */
export async function sendEscalationEmail(opts: {
  to: string;
  recipientName: string;
  taskTitle: string;
  taskId: number;
  reminderCount: number;
  appUrl?: string;
}): Promise<boolean> {
  const appUrl = opts.appUrl ?? "https://hilcotflow.com";
  const taskUrl = `${appUrl}/tasks/${opts.taskId}`;

  return sendEmail({
    to: opts.to,
    subject: `Escalated: ${opts.taskTitle}`,
    preheader: `Task "${opts.taskTitle}" has been escalated after ${opts.reminderCount} reminders.`,
    bodyHtml: `
      <h1 style="margin:0 0 8px; font-size:22px; font-weight:700; color:#ef4444;">Task Escalated</h1>
      <p style="margin:0 0 24px; font-size:15px; color:#475569;">Hi ${opts.recipientName}, a task has been escalated because it has not been addressed after multiple reminders.</p>

      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%; background:#fef2f2; border-radius:8px; border:1px solid #fecaca; margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 6px; font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.8px;">Escalated Task</p>
            <p style="margin:0 0 12px; font-size:17px; font-weight:600; color:#0f172a;">${opts.taskTitle}</p>
            <p style="margin:0; font-size:14px; color:#64748b;">This task has been reminded <strong>${opts.reminderCount} times</strong> without resolution.</p>
          </td>
        </tr>
      </table>

      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="border-radius:8px; background:#ef4444;">
            <a href="${taskUrl}" style="display:inline-block; padding:12px 28px; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; border-radius:8px;">Review Task →</a>
          </td>
        </tr>
      </table>
    `,
    text: `Task Escalated: ${opts.taskTitle}\n\nHi ${opts.recipientName},\n\nThis task has been escalated after ${opts.reminderCount} reminders without resolution.\n\nTask: ${opts.taskTitle}\n\nReview task: ${taskUrl}`,
  });
}

/**
 * Generic owner notification email — replaces the Manus notifyOwner fallback.
 */
export async function sendOwnerNotificationEmail(opts: {
  to: string;
  ownerName: string;
  title: string;
  content: string;
  appUrl?: string;
}): Promise<boolean> {
  const appUrl = opts.appUrl ?? "https://hilcotflow.com";

  return sendEmail({
    to: opts.to,
    subject: opts.title,
    preheader: opts.content.substring(0, 100),
    bodyHtml: `
      <h1 style="margin:0 0 8px; font-size:22px; font-weight:700; color:#0f172a;">${opts.title}</h1>
      <p style="margin:0 0 24px; font-size:15px; color:#475569;">Hi ${opts.ownerName},</p>

      <div style="background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; padding:20px 24px; margin-bottom:24px;">
        <p style="margin:0; font-size:15px; color:#334155; white-space:pre-wrap; line-height:1.7;">${opts.content}</p>
      </div>

      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="border-radius:8px; background:${BRAND_BLUE};">
            <a href="${appUrl}" style="display:inline-block; padding:12px 28px; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; border-radius:8px;">Open Hilcot TaskFlow →</a>
          </td>
        </tr>
      </table>
    `,
    text: `${opts.title}\n\nHi ${opts.ownerName},\n\n${opts.content}\n\n${appUrl}`,
  });
}

/**
 * Test email — used to verify the email pipeline is working end-to-end.
 */
export async function sendTestEmail(opts: {
  to: string;
  recipientName: string;
}): Promise<boolean> {
  return sendEmail({
    to: opts.to,
    subject: "Hilcot TaskFlow — Email System Test",
    preheader: "Your email notifications are working correctly.",
    bodyHtml: `
      <h1 style="margin:0 0 8px; font-size:22px; font-weight:700; color:#0f172a;">Email System Active</h1>
      <p style="margin:0 0 20px; font-size:15px; color:#475569;">Hi ${opts.recipientName},</p>
      <p style="margin:0 0 20px; font-size:15px; color:#475569;">This is a confirmation that the Hilcot TaskFlow email notification system is working correctly.</p>

      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%; background:#f0fdf4; border-radius:8px; border:1px solid #bbf7d0; margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 8px; font-size:15px; font-weight:600; color:#166534;">✓ Sender verified</p>
            <p style="margin:0 0 8px; font-size:14px; color:#166534;">notifications@hilcotflow.com</p>
            <p style="margin:0 0 8px; font-size:15px; font-weight:600; color:#166534;">✓ Domain authenticated</p>
            <p style="margin:0; font-size:14px; color:#166534;">hilcotflow.com (DKIM + SPF verified)</p>
          </td>
        </tr>
      </table>

      <p style="margin:0; font-size:14px; color:#64748b;">You will receive task reminders, escalation alerts, and other notifications at this address.</p>
    `,
    text: `Hi ${opts.recipientName},\n\nThis is a confirmation that the Hilcot TaskFlow email notification system is working correctly.\n\nSender: notifications@hilcotflow.com\nDomain: hilcotflow.com (DKIM + SPF verified)\n\nYou will receive task reminders, escalation alerts, and other notifications at this address.`,
  });
}


/**
 * Invitation email — sent when a user invites someone to join Hilcot TaskFlow.
 */
export async function sendInvitationEmail(opts: {
  to: string;
  inviterName: string;
  inviteUrl: string;
  type?: "personal" | "workspace";
  workspaceName?: string;
}): Promise<boolean> {
  const contextLabel = opts.type === "workspace" && opts.workspaceName
    ? `the <strong>${opts.workspaceName}</strong> workspace on Hilcot TaskFlow`
    : `<strong>Hilcot TaskFlow</strong>`;
  const subject = opts.type === "workspace" && opts.workspaceName
    ? `${opts.inviterName} invited you to join ${opts.workspaceName}`
    : `${opts.inviterName} invited you to Hilcot TaskFlow`;
  return sendEmail({
    to: opts.to,
    subject,
    preheader: `${opts.inviterName} wants to collaborate with you on Hilcot TaskFlow.`,
    bodyHtml: `
      <p style="margin:0 0 20px; font-size:15px; color:#475569;"><strong>${opts.inviterName}</strong> has invited you to join ${contextLabel}.</p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 8px; font-size:15px; color:#334155;">With Hilcot TaskFlow you can:</p>
            <ul style="margin:0; padding-left:20px; font-size:14px; color:#475569; line-height:1.8;">
              <li>Manage and prioritise your tasks</li>
              <li>Assign tasks to colleagues and track progress</li>
              <li>Receive smart reminders and escalation alerts</li>
            </ul>
          </td>
        </tr>
      </table>
      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="border-radius:8px; background:${BRAND_BLUE};">
            <a href="${opts.inviteUrl}" style="display:inline-block; padding:14px 32px; color:#ffffff; font-size:16px; font-weight:600; text-decoration:none; border-radius:8px;">Accept Invitation</a>
          </td>
        </tr>
      </table>
      <p style="margin:24px 0 0; font-size:13px; color:#94a3b8;">This invitation expires in 7 days.</p>
    `,
    text: `${opts.inviterName} has invited you to join Hilcot TaskFlow.

Accept your invitation: ${opts.inviteUrl}

This invitation expires in 7 days.`,
  });
}

/**
 * Daily workspace task digest email — sent to all workspace members once per day.
 * Summarises tasks assigned today, completed today, and currently overdue.
 */
export async function sendWorkspaceDigestEmail(opts: {
  to: string;
  recipientName: string;
  workspaceName: string;
  workspaceId: number;
  date: Date;
  assignedToday: { id: number; title: string; assignedByName: string | null; priority: string }[];
  completedToday: { id: number; title: string; completedByName: string | null }[];
  overdue: { id: number; title: string; assignedToName: string | null; dueSince: Date | null }[];
  appUrl?: string;
}): Promise<boolean> {
  const appUrl = opts.appUrl ?? "https://hilcotflow.com";
  const wsUrl = `${appUrl}/workspace`;
  const dateStr = opts.date.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  function taskRow(title: string, taskId: number, meta: string, color: string) {
    return `
      <tr>
        <td style="padding:10px 16px; border-bottom:1px solid #f1f5f9;">
          <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
            <tr>
              <td>
                <a href="${appUrl}/tasks/${taskId}" style="font-size:14px; font-weight:600; color:#0f172a; text-decoration:none;">${title}</a>
                <p style="margin:2px 0 0; font-size:12px; color:#94a3b8;">${meta}</p>
              </td>
              <td style="text-align:right; vertical-align:top; white-space:nowrap;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${color}; margin-top:4px;"></span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }

  function section(title: string, icon: string, color: string, rows: string, emptyMsg: string) {
    return `
      <div style="margin-bottom:28px;">
        <p style="margin:0 0 12px; font-size:13px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.8px;">${icon} ${title}</p>
        <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; overflow:hidden;">
          ${rows || `<tr><td style="padding:14px 16px; font-size:14px; color:#94a3b8;">${emptyMsg}</td></tr>`}
        </table>
      </div>`;
  }

  const assignedRows = opts.assignedToday.map((t) =>
    taskRow(t.title, t.id, `Assigned by ${t.assignedByName ?? "someone"} · ${t.priority}`, "#3b82f6")
  ).join("");

  const completedRows = opts.completedToday.map((t) =>
    taskRow(t.title, t.id, `Completed by ${t.completedByName ?? "someone"}`, "#22c55e")
  ).join("");

  const overdueRows = opts.overdue.map((t) => {
    const sinceTxt = t.dueSince ? `Due ${t.dueSince.toLocaleDateString("en-GB", { month: "short", day: "numeric" })}` : "Overdue";
    return taskRow(t.title, t.id, `${sinceTxt}${t.assignedToName ? ` · ${t.assignedToName}` : ""}`, "#ef4444");
  }).join("");

  const totalCount = opts.assignedToday.length + opts.completedToday.length + opts.overdue.length;
  const preheader = totalCount === 0
    ? `No pending tasks in ${opts.workspaceName} today.`
    : `${opts.completedToday.length} completed · ${opts.assignedToday.length} assigned · ${opts.overdue.length} overdue in ${opts.workspaceName}`;

  return sendEmail({
    to: opts.to,
    subject: `Daily Digest: ${opts.workspaceName} — ${dateStr}`,
    preheader,
    bodyHtml: `
      <div style="margin-bottom:8px;">
        <span style="display:inline-block; padding:3px 12px; border-radius:20px; background:#eff6ff; color:#2563eb; font-size:12px; font-weight:600; border:1px solid #bfdbfe;">${opts.workspaceName}</span>
      </div>
      <h1 style="margin:0 0 4px; font-size:22px; font-weight:700; color:#0f172a;">Daily Task Digest</h1>
      <p style="margin:0 0 28px; font-size:14px; color:#64748b;">${dateStr} · Hi ${opts.recipientName}</p>

      ${section("Assigned Today", "📋", "#3b82f6", assignedRows, "No tasks were assigned today.")}
      ${section("Completed Today", "✅", "#22c55e", completedRows, "No tasks were completed today.")}
      ${section("Currently Overdue", "⚠️", "#ef4444", overdueRows, "No overdue tasks — great work!")}

      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="border-radius:8px; background:${BRAND_BLUE};">
            <a href="${wsUrl}" style="display:inline-block; padding:12px 28px; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; border-radius:8px;">View Workspace →</a>
          </td>
        </tr>
      </table>
    `,
    text: `Daily Task Digest: ${opts.workspaceName}\n${dateStr}\n\nHi ${opts.recipientName},\n\nAssigned today: ${opts.assignedToday.length}\nCompleted today: ${opts.completedToday.length}\nOverdue: ${opts.overdue.length}\n\nView workspace: ${wsUrl}`,
  });
}
