CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`userId` int NOT NULL,
	`action` enum('created','updated','assigned','shared','unshared','status_changed','completed','reopened','reminder_sent','priority_changed','due_date_changed') NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`userId` int NOT NULL,
	`sharedById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_shares_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`priority` enum('normal','priority','critical') NOT NULL DEFAULT 'normal',
	`status` enum('pending','in_progress','completed','overdue') NOT NULL DEFAULT 'pending',
	`dueDate` timestamp,
	`createdById` int NOT NULL,
	`assignedToId` int,
	`completedById` int,
	`completedAt` timestamp,
	`reminderEnabled` boolean NOT NULL DEFAULT false,
	`reminderIntervalMinutes` int,
	`reminderRecipients` enum('assignee','shared','all') DEFAULT 'assignee',
	`lastReminderSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
