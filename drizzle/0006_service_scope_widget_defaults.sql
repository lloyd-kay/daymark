PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_services_workspace_id` ON `services` (`workspace_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_workspace_embed_preferences` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`default_mode` text NOT NULL,
	`default_service_scope` text NOT NULL,
	`default_service_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`,`default_service_id`) REFERENCES `services`(`workspace_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "workspace_embed_preferences_default_mode_check" CHECK("__new_workspace_embed_preferences"."default_mode" in ('floating', 'inline')),
	CONSTRAINT "workspace_embed_preferences_service_scope_check" CHECK((
        "__new_workspace_embed_preferences"."default_service_scope" = 'all' and "__new_workspace_embed_preferences"."default_service_id" is null
      ) or (
        "__new_workspace_embed_preferences"."default_service_scope" = 'service' and "__new_workspace_embed_preferences"."default_service_id" is not null
      ))
);
--> statement-breakpoint
INSERT INTO `__new_workspace_embed_preferences`("workspace_id", "default_mode", "default_service_scope", "default_service_id", "created_at", "updated_at") SELECT "workspace_id", "default_mode", 'all', NULL, "created_at", "updated_at" FROM `workspace_embed_preferences`;--> statement-breakpoint
DROP TABLE `workspace_embed_preferences`;--> statement-breakpoint
ALTER TABLE `__new_workspace_embed_preferences` RENAME TO `workspace_embed_preferences`;--> statement-breakpoint
PRAGMA foreign_key_check;--> statement-breakpoint
PRAGMA optimize;--> statement-breakpoint
PRAGMA foreign_keys=ON;
