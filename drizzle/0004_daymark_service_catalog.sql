CREATE TABLE `employee_service_qualifications` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`employee_profile_id` text NOT NULL,
	`service_id` text NOT NULL,
	`method` text NOT NULL,
	`certificate_name` text,
	`certificate_reference` text,
	`issued_on` text,
	`expires_on` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "employee_service_qualifications_method_check" CHECK("employee_service_qualifications"."method" in ('manual', 'certificate'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_employee_service_qualifications_pair` ON `employee_service_qualifications` (`workspace_id`,`employee_profile_id`,`service_id`);--> statement-breakpoint
CREATE INDEX `idx_employee_service_qualifications_service_active` ON `employee_service_qualifications` (`workspace_id`,`service_id`,`active`,`expires_on`);--> statement-breakpoint
CREATE INDEX `idx_employee_service_qualifications_employee_active` ON `employee_service_qualifications` (`workspace_id`,`employee_profile_id`,`active`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`duration_minutes` integer DEFAULT 30 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "services_duration_check" CHECK("services"."duration_minutes" between 15 and 480 and "services"."duration_minutes" % 15 = 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_services_workspace_slug` ON `services` (`workspace_id`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_services_workspace_active_sort` ON `services` (`workspace_id`,`active`,`sort_order`);--> statement-breakpoint
insert into `services` (
	`id`,
	`workspace_id`,
	`slug`,
	`name`,
	`category`,
	`description`,
	`duration_minutes`,
	`active`,
	`sort_order`
)
select
	'service-general-' || `id`,
	`id`,
	'general-appointment',
	'General appointment',
	'General',
	'General appointment booking.',
	30,
	true,
	0
from `workspaces`;
--> statement-breakpoint
insert into `employee_service_qualifications` (
	`id`,
	`workspace_id`,
	`employee_profile_id`,
	`service_id`,
	`method`,
	`active`
)
select
	'qualification-general-' || `employee_profiles`.`id`,
	`employee_profiles`.`workspace_id`,
	`employee_profiles`.`id`,
	'service-general-' || `employee_profiles`.`workspace_id`,
	'manual',
	true
from `employee_profiles`
where `employee_profiles`.`active` = true;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`public_reference` text NOT NULL,
	`service_id` text,
	`service_name` text DEFAULT 'General appointment' NOT NULL,
	`service_duration_minutes` integer DEFAULT 30 NOT NULL,
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
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "appointments_status_check" CHECK("__new_appointments"."status" in ('booked', 'cancelled')),
	CONSTRAINT "appointments_window_check" CHECK("__new_appointments"."start_at" < "__new_appointments"."end_at"),
	CONSTRAINT "appointments_service_duration_check" CHECK("__new_appointments"."service_duration_minutes" between 15 and 480 and "__new_appointments"."service_duration_minutes" % 15 = 0)
);
--> statement-breakpoint
INSERT INTO `__new_appointments`("id", "workspace_id", "public_reference", "service_id", "service_name", "service_duration_minutes", "employee_profile_id", "start_at", "end_at", "client_name", "client_address", "client_email", "client_phone", "client_note", "status", "created_at", "updated_at") SELECT "id", "workspace_id", "public_reference", NULL, 'General appointment', 30, "employee_profile_id", "start_at", "end_at", "client_name", "client_address", "client_email", "client_phone", "client_note", "status", "created_at", "updated_at" FROM `appointments`;--> statement-breakpoint
DROP TABLE `appointments`;--> statement-breakpoint
ALTER TABLE `__new_appointments` RENAME TO `appointments`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_appointments_public_reference` ON `appointments` (`public_reference`);--> statement-breakpoint
CREATE INDEX `idx_appointments_employee_time` ON `appointments` (`workspace_id`,`employee_profile_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `idx_appointments_retention` ON `appointments` (`end_at`);--> statement-breakpoint
CREATE INDEX `idx_appointments_service` ON `appointments` (`workspace_id`,`service_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_appointments_employee_start_booked` ON `appointments` (`workspace_id`,`employee_profile_id`,`start_at`) WHERE "appointments"."status" = 'booked';--> statement-breakpoint
update `appointments`
set
	`service_id` = 'service-general-' || `workspace_id`,
	`service_name` = 'General appointment',
	`service_duration_minutes` = 30;
--> statement-breakpoint
PRAGMA foreign_key_check;
--> statement-breakpoint
PRAGMA optimize;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
