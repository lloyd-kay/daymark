CREATE TABLE `workspace_embed_preferences` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`default_mode` text NOT NULL,
	`default_service_scope` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "workspace_embed_preferences_default_mode_check" CHECK("workspace_embed_preferences"."default_mode" in ('floating', 'inline')),
	CONSTRAINT "workspace_embed_preferences_service_scope_check" CHECK("workspace_embed_preferences"."default_service_scope" in ('all'))
);
--> statement-breakpoint
INSERT INTO `workspace_embed_preferences`
  (`workspace_id`, `default_mode`, `default_service_scope`, `created_at`, `updated_at`)
SELECT `id`, 'floating', 'all', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM `workspaces`;
--> statement-breakpoint
PRAGMA foreign_key_check;
--> statement-breakpoint
PRAGMA optimize;
