-- ─── Seed Data for Hilcot TaskFlow ───────────────────────────────────────────
-- Demo users (these will be created on first OAuth login, but we seed some for demo)
-- NOTE: In production, users are created via OAuth. This seed is for demo/testing.

-- Demo tasks (using userId=1 as the owner/admin)
-- These will be visible once the first user logs in

-- Insert demo tasks for user ID 1 (first user to log in becomes the demo owner)
INSERT INTO tasks (title, description, priority, status, dueDate, createdById, assignedToId, reminderEnabled, reminderIntervalMinutes, reminderRecipients, createdAt, updatedAt)
VALUES
  -- Critical tasks
  ('Q1 Board Report Submission', 'Prepare and submit the Q1 financial board report including all department summaries and KPI analysis.', 'critical', 'pending', DATE_ADD(NOW(), INTERVAL 2 DAY), 1, 1, true, 60, 'all', NOW(), NOW()),
  ('Client Contract Renewal — Apex Corp', 'Review and finalize the contract renewal terms for Apex Corporation. Legal review required before signing.', 'critical', 'in_progress', DATE_ADD(NOW(), INTERVAL 1 DAY), 1, 1, true, 120, 'assignee', NOW(), NOW()),
  ('Security Audit Response', 'Address all findings from the recent security audit. Critical vulnerabilities must be patched within 48 hours.', 'critical', 'pending', DATE_SUB(NOW(), INTERVAL 1 DAY), 1, 1, true, 60, 'all', NOW(), NOW()),

  -- Priority tasks
  ('Team Performance Reviews', 'Complete mid-year performance reviews for all direct reports. Submit to HR by end of week.', 'priority', 'pending', DATE_ADD(NOW(), INTERVAL 5 DAY), 1, 1, true, 240, 'assignee', NOW(), NOW()),
  ('Budget Reforecast FY2026', 'Update budget projections based on Q1 actuals. Include variance analysis and revised forecasts.', 'priority', 'in_progress', DATE_ADD(NOW(), INTERVAL 7 DAY), 1, 1, true, 120, 'assignee', NOW(), NOW()),
  ('Vendor Evaluation — Cloud Services', 'Complete evaluation of three cloud service providers and prepare recommendation memo.', 'priority', 'pending', DATE_ADD(NOW(), INTERVAL 10 DAY), 1, 1, false, null, null, NOW(), NOW()),

  -- Normal tasks
  ('Update Team Meeting Agenda', 'Prepare agenda for the weekly team sync meeting. Include project status updates and blockers.', 'normal', 'pending', DATE_ADD(NOW(), INTERVAL 1 DAY), 1, 1, false, null, null, NOW(), NOW()),
  ('Review Marketing Campaign Brief', 'Review and provide feedback on the Q2 marketing campaign brief submitted by the marketing team.', 'normal', 'pending', DATE_ADD(NOW(), INTERVAL 3 DAY), 1, 1, false, null, null, NOW(), NOW()),
  ('Office Supplies Procurement', 'Approve purchase order for office supplies. Budget approved, pending manager sign-off.', 'normal', 'completed', null, 1, 1, false, null, null, DATE_SUB(NOW(), INTERVAL 2 DAY), NOW()),
  ('Onboarding Documentation Update', 'Update the employee onboarding documentation to reflect new HR policies and procedures.', 'normal', 'completed', null, 1, 1, false, null, null, DATE_SUB(NOW(), INTERVAL 3 DAY), NOW());

-- Update completed tasks
UPDATE tasks SET completedById = 1, completedAt = DATE_SUB(NOW(), INTERVAL 1 DAY), reminderEnabled = false
WHERE title IN ('Office Supplies Procurement', 'Onboarding Documentation Update');

-- Mark overdue task
UPDATE tasks SET status = 'overdue' WHERE title = 'Security Audit Response';

-- Activity log for created tasks
INSERT INTO activity_log (taskId, userId, action, details, createdAt)
SELECT id, 1, 'created', JSON_OBJECT('title', title, 'priority', priority), DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 5) DAY)
FROM tasks WHERE createdById = 1;

-- Activity log for completed tasks
INSERT INTO activity_log (taskId, userId, action, details, createdAt)
SELECT id, 1, 'completed', JSON_OBJECT('completedById', 1), completedAt
FROM tasks WHERE status = 'completed';
