CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`membership_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text NOT NULL,
	`idle_expires_at` text NOT NULL,
	`absolute_expires_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_auth_sessions_token_hash` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_membership_expiry` ON `auth_sessions` (`membership_id`,`idle_expires_at`,`absolute_expires_at`);--> statement-breakpoint
CREATE TABLE `credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`membership_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_iterations` integer NOT NULL,
	`must_change_password` integer DEFAULT true NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_credentials_membership_id` ON `credentials` (`membership_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_credentials_email` ON `credentials` (`email`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`email_hash` text NOT NULL,
	`fingerprint_hash` text NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`window_started_at` text NOT NULL,
	`locked_until` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_login_attempts_subject` ON `login_attempts` (`email_hash`,`fingerprint_hash`);--> statement-breakpoint
CREATE INDEX `idx_login_attempts_updated` ON `login_attempts` (`updated_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`public_reference` text NOT NULL,
	`employee_profile_id` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`client_name` text NOT NULL,
	`client_address` text DEFAULT '' NOT NULL,
	`client_email` text,
	`client_phone` text,
	`client_note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'booked' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "appointments_status_check" CHECK("__new_appointments"."status" in ('booked', 'cancelled')),
	CONSTRAINT "appointments_window_check" CHECK("__new_appointments"."start_at" < "__new_appointments"."end_at")
);
--> statement-breakpoint
INSERT INTO `__new_appointments`("id", "public_reference", "employee_profile_id", "start_at", "end_at", "client_name", "client_address", "client_email", "client_phone", "client_note", "status", "created_at", "updated_at") SELECT "id", "public_reference", "employee_profile_id", "start_at", "end_at", "client_name", '', "client_email", NULL, "client_note", "status", "created_at", "updated_at" FROM `appointments`;--> statement-breakpoint
DROP TABLE `appointments`;--> statement-breakpoint
ALTER TABLE `__new_appointments` RENAME TO `appointments`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_appointments_public_reference` ON `appointments` (`public_reference`);--> statement-breakpoint
CREATE INDEX `idx_appointments_employee_time` ON `appointments` (`employee_profile_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `idx_appointments_retention` ON `appointments` (`end_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_appointments_employee_start_booked` ON `appointments` (`employee_profile_id`,`start_at`) WHERE "appointments"."status" = 'booked';--> statement-breakpoint
CREATE TABLE `__new_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`oai_user_id` text,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "memberships_role_check" CHECK("__new_memberships"."role" in ('admin', 'employee'))
);
--> statement-breakpoint
INSERT INTO `__new_memberships`("id", "oai_user_id", "email", "display_name", "role", "active", "created_at", "updated_at") SELECT "id", "oai_user_id", "email", "display_name", "role", "active", "created_at", "updated_at" FROM `memberships`;--> statement-breakpoint
DROP TABLE `memberships`;--> statement-breakpoint
ALTER TABLE `__new_memberships` RENAME TO `memberships`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_memberships_oai_user_id` ON `memberships` (`oai_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_memberships_single_admin` ON `memberships` (`role`) WHERE "memberships"."role" = 'admin';--> statement-breakpoint
PRAGMA foreign_keys=ON;
