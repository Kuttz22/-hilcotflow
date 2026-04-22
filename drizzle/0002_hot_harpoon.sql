CREATE TABLE `device_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(512) NOT NULL,
	`platform` enum('web','android','ios') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `device_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminder_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`intervalMinutes` int NOT NULL,
	`nextRunAt` timestamp NOT NULL,
	`lastRunAt` timestamp,
	`status` enum('active','stopped') NOT NULL DEFAULT 'active',
	`recipients` text NOT NULL,
	`reminderCount` int NOT NULL DEFAULT 0,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reminder_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`quietHoursStart` varchar(5),
	`quietHoursEnd` varchar(5),
	`maxRemindersPerDay` int NOT NULL DEFAULT 10,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_preferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `activity_log` MODIFY COLUMN `action` enum('created','updated','assigned','shared','unshared','status_changed','completed','reopened','reminder_sent','priority_changed','due_date_changed','escalated','escalation_alert') NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `status` enum('pending','in_progress','completed','overdue','escalated') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `tasks` ADD `completionPermission` enum('creator_only','assignee_only','any_participant') DEFAULT 'any_participant' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `isOverdue` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `lastSeenAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);