CREATE TYPE "public"."ad_slot" AS ENUM('sidebar', 'inline', 'footer');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'live', 'finished');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('group', 'r32', 'r16', 'qf', 'sf', 'final');--> statement-breakpoint
CREATE TABLE "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_url" text NOT NULL,
	"link_url" text,
	"slot" "ad_slot" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"predictions_lock_at" timestamp with time zone,
	"prize_text" text,
	"pts_exact" integer DEFAULT 3 NOT NULL,
	"pts_result" integer DEFAULT 1 NOT NULL,
	"pts_reach_r16" integer DEFAULT 1 NOT NULL,
	"pts_reach_qf" integer DEFAULT 2 NOT NULL,
	"pts_reach_sf" integer DEFAULT 3 NOT NULL,
	"pts_reach_final" integer DEFAULT 5 NOT NULL,
	"pts_champion" integer DEFAULT 10 NOT NULL,
	"pts_runner_up" integer DEFAULT 5 NOT NULL,
	"pts_golden_boot" integer DEFAULT 5 NOT NULL,
	"pts_best_player" integer DEFAULT 5 NOT NULL,
	"pts_surprise" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "award_predictions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"champion_team_id" uuid,
	"runner_up_team_id" uuid,
	"golden_boot_player_id" uuid,
	"best_player_id" uuid,
	"surprise_team_id" uuid,
	"points_awarded" integer
);
--> statement-breakpoint
CREATE TABLE "bracket_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stage" "stage" NOT NULL,
	"team_id" uuid NOT NULL,
	"points_awarded" integer,
	CONSTRAINT "bracket_predictions_user_id_stage_team_id_unique" UNIQUE("user_id","stage","team_id")
);
--> statement-breakpoint
CREATE TABLE "match_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"home_score" integer NOT NULL,
	"away_score" integer NOT NULL,
	"points_awarded" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_predictions_user_id_match_id_unique" UNIQUE("user_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text,
	"stage" "stage" NOT NULL,
	"group_name" text,
	"home_team_id" uuid,
	"away_team_id" uuid,
	"venue_id" uuid,
	"kickoff_at" timestamp with time zone NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	CONSTRAINT "matches_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" text,
	"shirt_number" integer,
	"club" text,
	"age" integer,
	"caps" integer,
	"photo_url" text,
	"golden_boot_eligible" boolean DEFAULT true NOT NULL,
	"best_player_eligible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"avatar_seed" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"flag" text,
	"group_name" text,
	"fifa_rank" integer,
	"wc_titles" integer DEFAULT 0 NOT NULL,
	"coach" text
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"country" text
);
--> statement-breakpoint
ALTER TABLE "award_predictions" ADD CONSTRAINT "award_predictions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_predictions" ADD CONSTRAINT "award_predictions_champion_team_id_teams_id_fk" FOREIGN KEY ("champion_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_predictions" ADD CONSTRAINT "award_predictions_runner_up_team_id_teams_id_fk" FOREIGN KEY ("runner_up_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_predictions" ADD CONSTRAINT "award_predictions_golden_boot_player_id_players_id_fk" FOREIGN KEY ("golden_boot_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_predictions" ADD CONSTRAINT "award_predictions_best_player_id_players_id_fk" FOREIGN KEY ("best_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_predictions" ADD CONSTRAINT "award_predictions_surprise_team_id_teams_id_fk" FOREIGN KEY ("surprise_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_predictions" ADD CONSTRAINT "bracket_predictions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_predictions" ADD CONSTRAINT "bracket_predictions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_predictions" ADD CONSTRAINT "match_predictions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_predictions" ADD CONSTRAINT "match_predictions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;