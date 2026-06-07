CREATE TABLE "group_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_name" text NOT NULL,
	"team_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"advances_as_third" boolean DEFAULT false NOT NULL,
	"points_awarded" integer,
	CONSTRAINT "group_predictions_user_id_team_id_unique" UNIQUE("user_id","team_id")
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "pts_group_position" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "pts_third_qualifier" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "actual_golden_boot_player_id" uuid;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "actual_best_player_id" uuid;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "actual_surprise_team_id" uuid;--> statement-breakpoint
ALTER TABLE "group_predictions" ADD CONSTRAINT "group_predictions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_predictions" ADD CONSTRAINT "group_predictions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_actual_golden_boot_player_id_players_id_fk" FOREIGN KEY ("actual_golden_boot_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_actual_best_player_id_players_id_fk" FOREIGN KEY ("actual_best_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_actual_surprise_team_id_teams_id_fk" FOREIGN KEY ("actual_surprise_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;