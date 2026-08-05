CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`public_reference` text NOT NULL,
	`employee_profile_id` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`client_name` text NOT NULL,
	`client_email` text NOT NULL,
	`client_note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'booked' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "appointments_status_check" CHECK("appointments"."status" in ('booked', 'cancelled')),
	CONSTRAINT "appointments_window_check" CHECK("appointments"."start_at" < "appointments"."end_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_appointments_public_reference` ON `appointments` (`public_reference`);--> statement-breakpoint
CREATE INDEX `idx_appointments_employee_time` ON `appointments` (`employee_profile_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `idx_appointments_retention` ON `appointments` (`end_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_appointments_employee_start_booked` ON `appointments` (`employee_profile_id`,`start_at`) WHERE "appointments"."status" = 'booked';--> statement-breakpoint
CREATE TABLE `availability_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_profile_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`start_minute` integer NOT NULL,
	`end_minute` integer NOT NULL,
	`slot_minutes` integer DEFAULT 30 NOT NULL,
	`buffer_minutes` integer DEFAULT 10 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "availability_weekday_check" CHECK("availability_rules"."weekday" between 0 and 6),
	CONSTRAINT "availability_window_check" CHECK("availability_rules"."start_minute" >= 0 and "availability_rules"."end_minute" <= 1440 and "availability_rules"."start_minute" < "availability_rules"."end_minute"),
	CONSTRAINT "availability_slot_check" CHECK("availability_rules"."slot_minutes" between 15 and 240),
	CONSTRAINT "availability_buffer_check" CHECK("availability_rules"."buffer_minutes" between 0 and 120)
);
--> statement-breakpoint
CREATE INDEX `idx_availability_employee_weekday` ON `availability_rules` (`employee_profile_id`,`weekday`,`active`);--> statement-breakpoint
CREATE TABLE `blocked_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_profile_id` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "blocked_period_window_check" CHECK("blocked_periods"."start_at" < "blocked_periods"."end_at")
);
--> statement-breakpoint
CREATE INDEX `idx_blocked_periods_employee_time` ON `blocked_periods` (`employee_profile_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE TABLE `employee_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`membership_id` text,
	`public_name` text NOT NULL,
	`title` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`accent` text DEFAULT 'coral' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_employee_profiles_membership_id` ON `employee_profiles` (`membership_id`);--> statement-breakpoint
CREATE INDEX `idx_employee_profiles_active_sort` ON `employee_profiles` (`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`employee_profile_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`redeemed_at` text,
	`created_by_membership_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_membership_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invitations_code_hash` ON `invitations` (`code_hash`);--> statement-breakpoint
CREATE INDEX `idx_invitations_profile_expiry` ON `invitations` (`employee_profile_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`oai_user_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "memberships_role_check" CHECK("memberships"."role" in ('admin', 'employee'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_memberships_oai_user_id` ON `memberships` (`oai_user_id`);