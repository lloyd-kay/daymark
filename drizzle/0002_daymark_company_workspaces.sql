PRAGMA foreign_keys=OFF;
--> statement-breakpoint
create table `workspaces` (
  `id` text primary key not null,
  `name` text not null,
  `slug` text not null,
  `active` integer default true not null,
  `created_at` text default CURRENT_TIMESTAMP not null,
  `updated_at` text default CURRENT_TIMESTAMP not null
);
--> statement-breakpoint
create unique index `idx_workspaces_slug` on `workspaces` (`slug`);
--> statement-breakpoint
insert into `workspaces` (`id`, `name`, `slug`, `active`)
values ('workspace-daymark', 'Daymark', 'daymark', true);
--> statement-breakpoint
create table `accounts` (
  `id` text primary key not null,
  `email` text not null,
  `display_name` text not null,
  `active` integer default true not null,
  `created_at` text default CURRENT_TIMESTAMP not null,
  `updated_at` text default CURRENT_TIMESTAMP not null
);
--> statement-breakpoint
create unique index `idx_accounts_email` on `accounts` (`email`);
--> statement-breakpoint
insert or ignore into `accounts`
  (`id`, `email`, `display_name`, `active`, `created_at`, `updated_at`)
select
  `id`, lower(trim(`email`)), `display_name`, `active`, `created_at`, `updated_at`
from `memberships`;
--> statement-breakpoint
create table `__new_memberships` (
  `id` text primary key not null,
  `workspace_id` text not null,
  `account_id` text not null,
  `role` text not null,
  `active` integer default true not null,
  `created_at` text default CURRENT_TIMESTAMP not null,
  `updated_at` text default CURRENT_TIMESTAMP not null,
  foreign key (`workspace_id`) references `workspaces`(`id`) on update no action on delete cascade,
  foreign key (`account_id`) references `accounts`(`id`) on update no action on delete cascade,
  constraint `memberships_role_check` check(`role` in ('admin', 'employee'))
);
--> statement-breakpoint
insert into `__new_memberships`
  (`id`, `workspace_id`, `account_id`, `role`, `active`, `created_at`, `updated_at`)
select
  `memberships`.`id`,
  'workspace-daymark',
  `accounts`.`id`,
  `memberships`.`role`,
  `memberships`.`active`,
  `memberships`.`created_at`,
  `memberships`.`updated_at`
from `memberships`
inner join `accounts`
  on `accounts`.`email` = lower(trim(`memberships`.`email`));
--> statement-breakpoint
create table `__new_credentials` (
  `id` text primary key not null,
  `account_id` text not null,
  `password_hash` text not null,
  `password_salt` text not null,
  `password_iterations` integer not null,
  `must_change_password` integer default true not null,
  `failed_attempts` integer default 0 not null,
  `locked_until` text,
  `created_at` text default CURRENT_TIMESTAMP not null,
  `updated_at` text default CURRENT_TIMESTAMP not null,
  foreign key (`account_id`) references `accounts`(`id`) on update no action on delete cascade
);
--> statement-breakpoint
insert or ignore into `__new_credentials`
  (`id`, `account_id`, `password_hash`, `password_salt`, `password_iterations`, `must_change_password`, `failed_attempts`, `locked_until`, `created_at`, `updated_at`)
select
  `credentials`.`id`,
  `accounts`.`id`,
  `credentials`.`password_hash`,
  `credentials`.`password_salt`,
  `credentials`.`password_iterations`,
  `credentials`.`must_change_password`,
  `credentials`.`failed_attempts`,
  `credentials`.`locked_until`,
  `credentials`.`created_at`,
  `credentials`.`updated_at`
from `credentials`
inner join `accounts`
  on `accounts`.`email` = lower(trim(`credentials`.`email`));
--> statement-breakpoint
create table `__new_auth_sessions` (
  `id` text primary key not null,
  `account_id` text not null,
  `token_hash` text not null,
  `created_at` text not null,
  `last_used_at` text not null,
  `idle_expires_at` text not null,
  `absolute_expires_at` text not null,
  `revoked_at` text,
  foreign key (`account_id`) references `accounts`(`id`) on update no action on delete cascade
);
--> statement-breakpoint
insert into `__new_auth_sessions`
  (`id`, `account_id`, `token_hash`, `created_at`, `last_used_at`, `idle_expires_at`, `absolute_expires_at`, `revoked_at`)
select
  `auth_sessions`.`id`,
  `accounts`.`id`,
  `auth_sessions`.`token_hash`,
  `auth_sessions`.`created_at`,
  `auth_sessions`.`last_used_at`,
  `auth_sessions`.`idle_expires_at`,
  `auth_sessions`.`absolute_expires_at`,
  `auth_sessions`.`revoked_at`
from `auth_sessions`
inner join `memberships`
  on `memberships`.`id` = `auth_sessions`.`membership_id`
inner join `accounts`
  on `accounts`.`email` = lower(trim(`memberships`.`email`));
--> statement-breakpoint
create table `__new_employee_profiles` (
  `id` text primary key not null,
  `workspace_id` text not null,
  `membership_id` text,
  `public_name` text not null,
  `title` text not null,
  `bio` text default '' not null,
  `accent` text default 'coral' not null,
  `active` integer default true not null,
  `sort_order` integer default 0 not null,
  `created_at` text default CURRENT_TIMESTAMP not null,
  `updated_at` text default CURRENT_TIMESTAMP not null,
  foreign key (`workspace_id`) references `workspaces`(`id`) on update no action on delete cascade,
  foreign key (`membership_id`) references `__new_memberships`(`id`) on update no action on delete set null
);
--> statement-breakpoint
insert into `__new_employee_profiles`
  (`id`, `workspace_id`, `membership_id`, `public_name`, `title`, `bio`, `accent`, `active`, `sort_order`, `created_at`, `updated_at`)
select
  `id`, 'workspace-daymark', `membership_id`, `public_name`, `title`, `bio`, `accent`, `active`, `sort_order`, `created_at`, `updated_at`
from `employee_profiles`;
--> statement-breakpoint
create table `__new_invitations` (
  `id` text primary key not null,
  `workspace_id` text not null,
  `code_hash` text not null,
  `email_hash` text not null,
  `role` text default 'employee' not null,
  `employee_profile_id` text,
  `expires_at` text not null,
  `redeemed_at` text,
  `created_by_membership_id` text not null,
  `created_at` text default CURRENT_TIMESTAMP not null,
  foreign key (`workspace_id`) references `workspaces`(`id`) on update no action on delete cascade,
  foreign key (`employee_profile_id`) references `__new_employee_profiles`(`id`) on update no action on delete cascade,
  foreign key (`created_by_membership_id`) references `__new_memberships`(`id`) on update no action on delete cascade,
  constraint `invitations_role_check` check(`role` in ('admin', 'employee'))
);
--> statement-breakpoint
insert into `__new_invitations`
  (`id`, `workspace_id`, `code_hash`, `email_hash`, `role`, `employee_profile_id`, `expires_at`, `redeemed_at`, `created_by_membership_id`, `created_at`)
select
  `id`, 'workspace-daymark', `code_hash`, `code_hash`, 'employee', `employee_profile_id`, `expires_at`, `redeemed_at`, `created_by_membership_id`, `created_at`
from `invitations`;
--> statement-breakpoint
create table `__new_availability_rules` (
  `id` text primary key not null,
  `workspace_id` text not null,
  `employee_profile_id` text not null,
  `weekday` integer not null,
  `start_minute` integer not null,
  `end_minute` integer not null,
  `slot_minutes` integer default 30 not null,
  `buffer_minutes` integer default 10 not null,
  `active` integer default true not null,
  `created_at` text default CURRENT_TIMESTAMP not null,
  `updated_at` text default CURRENT_TIMESTAMP not null,
  foreign key (`workspace_id`) references `workspaces`(`id`) on update no action on delete cascade,
  foreign key (`employee_profile_id`) references `__new_employee_profiles`(`id`) on update no action on delete cascade,
  constraint `availability_weekday_check` check(`weekday` between 0 and 6),
  constraint `availability_window_check` check(`start_minute` >= 0 and `end_minute` <= 1440 and `start_minute` < `end_minute`),
  constraint `availability_slot_check` check(`slot_minutes` between 15 and 240),
  constraint `availability_buffer_check` check(`buffer_minutes` between 0 and 120)
);
--> statement-breakpoint
insert into `__new_availability_rules`
  (`id`, `workspace_id`, `employee_profile_id`, `weekday`, `start_minute`, `end_minute`, `slot_minutes`, `buffer_minutes`, `active`, `created_at`, `updated_at`)
select
  `id`, 'workspace-daymark', `employee_profile_id`, `weekday`, `start_minute`, `end_minute`, `slot_minutes`, `buffer_minutes`, `active`, `created_at`, `updated_at`
from `availability_rules`;
--> statement-breakpoint
create table `__new_blocked_periods` (
  `id` text primary key not null,
  `workspace_id` text not null,
  `employee_profile_id` text not null,
  `start_at` text not null,
  `end_at` text not null,
  `note` text default '' not null,
  `created_at` text default CURRENT_TIMESTAMP not null,
  foreign key (`workspace_id`) references `workspaces`(`id`) on update no action on delete cascade,
  foreign key (`employee_profile_id`) references `__new_employee_profiles`(`id`) on update no action on delete cascade,
  constraint `blocked_period_window_check` check(`start_at` < `end_at`)
);
--> statement-breakpoint
insert into `__new_blocked_periods`
  (`id`, `workspace_id`, `employee_profile_id`, `start_at`, `end_at`, `note`, `created_at`)
select
  `id`, 'workspace-daymark', `employee_profile_id`, `start_at`, `end_at`, `note`, `created_at`
from `blocked_periods`;
--> statement-breakpoint
create table `__new_appointments` (
  `id` text primary key not null,
  `workspace_id` text not null,
  `public_reference` text not null,
  `employee_profile_id` text not null,
  `start_at` text not null,
  `end_at` text not null,
  `client_name` text not null,
  `client_address` text default '' not null,
  `client_email` text,
  `client_phone` text,
  `client_note` text default '' not null,
  `status` text default 'booked' not null,
  `created_at` text default CURRENT_TIMESTAMP not null,
  `updated_at` text default CURRENT_TIMESTAMP not null,
  foreign key (`workspace_id`) references `workspaces`(`id`) on update no action on delete cascade,
  foreign key (`employee_profile_id`) references `__new_employee_profiles`(`id`) on update no action on delete cascade,
  constraint `appointments_status_check` check(`status` in ('booked', 'cancelled')),
  constraint `appointments_window_check` check(`start_at` < `end_at`)
);
--> statement-breakpoint
insert into `__new_appointments`
  (`id`, `workspace_id`, `public_reference`, `employee_profile_id`, `start_at`, `end_at`, `client_name`, `client_address`, `client_email`, `client_phone`, `client_note`, `status`, `created_at`, `updated_at`)
select
  `id`, 'workspace-daymark', `public_reference`, `employee_profile_id`, `start_at`, `end_at`, `client_name`, `client_address`, `client_email`, `client_phone`, `client_note`, `status`, `created_at`, `updated_at`
from `appointments`;
--> statement-breakpoint
drop table `appointments`;
--> statement-breakpoint
drop table `blocked_periods`;
--> statement-breakpoint
drop table `availability_rules`;
--> statement-breakpoint
drop table `invitations`;
--> statement-breakpoint
drop table `employee_profiles`;
--> statement-breakpoint
drop table `auth_sessions`;
--> statement-breakpoint
drop table `credentials`;
--> statement-breakpoint
drop table `memberships`;
--> statement-breakpoint
alter table `__new_memberships` rename to `memberships`;
--> statement-breakpoint
alter table `__new_employee_profiles` rename to `employee_profiles`;
--> statement-breakpoint
alter table `__new_invitations` rename to `invitations`;
--> statement-breakpoint
alter table `__new_availability_rules` rename to `availability_rules`;
--> statement-breakpoint
alter table `__new_blocked_periods` rename to `blocked_periods`;
--> statement-breakpoint
alter table `__new_appointments` rename to `appointments`;
--> statement-breakpoint
alter table `__new_credentials` rename to `credentials`;
--> statement-breakpoint
alter table `__new_auth_sessions` rename to `auth_sessions`;
--> statement-breakpoint
create unique index `idx_memberships_workspace_account`
  on `memberships` (`workspace_id`, `account_id`);
--> statement-breakpoint
create index `idx_memberships_account_active`
  on `memberships` (`account_id`, `active`);
--> statement-breakpoint
create unique index `idx_credentials_account_id` on `credentials` (`account_id`);
--> statement-breakpoint
create unique index `idx_auth_sessions_token_hash` on `auth_sessions` (`token_hash`);
--> statement-breakpoint
create index `idx_auth_sessions_account_expiry`
  on `auth_sessions` (`account_id`, `idle_expires_at`, `absolute_expires_at`);
--> statement-breakpoint
drop index if exists `idx_employee_profiles_active_sort`;
--> statement-breakpoint
create unique index `idx_employee_profiles_membership_id`
  on `employee_profiles` (`membership_id`);
--> statement-breakpoint
create index `idx_employee_profiles_workspace_active_sort`
  on `employee_profiles` (`workspace_id`, `active`, `sort_order`);
--> statement-breakpoint
drop index if exists `idx_invitations_profile_expiry`;
--> statement-breakpoint
create unique index `idx_invitations_code_hash` on `invitations` (`code_hash`);
--> statement-breakpoint
create index `idx_invitations_workspace_expiry`
  on `invitations` (`workspace_id`, `expires_at`);
--> statement-breakpoint
drop index if exists `idx_availability_employee_weekday`;
--> statement-breakpoint
create index `idx_availability_employee_weekday`
  on `availability_rules` (`workspace_id`, `employee_profile_id`, `weekday`, `active`);
--> statement-breakpoint
drop index if exists `idx_blocked_periods_employee_time`;
--> statement-breakpoint
create index `idx_blocked_periods_employee_time`
  on `blocked_periods` (`workspace_id`, `employee_profile_id`, `start_at`, `end_at`);
--> statement-breakpoint
drop index if exists `idx_appointments_employee_time`;
--> statement-breakpoint
create unique index `idx_appointments_public_reference`
  on `appointments` (`public_reference`);
--> statement-breakpoint
create index `idx_appointments_employee_time`
  on `appointments` (`workspace_id`, `employee_profile_id`, `start_at`, `end_at`);
--> statement-breakpoint
create index `idx_appointments_retention` on `appointments` (`end_at`);
--> statement-breakpoint
drop index if exists `idx_appointments_employee_start_booked`;
--> statement-breakpoint
create unique index `idx_appointments_employee_start_booked`
  on `appointments` (`workspace_id`, `employee_profile_id`, `start_at`)
  where `status` = 'booked';
--> statement-breakpoint
PRAGMA foreign_key_check;
--> statement-breakpoint
PRAGMA optimize;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
