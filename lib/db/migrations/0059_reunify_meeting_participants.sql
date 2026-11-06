CREATE TABLE "reunify_meeting_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reunify_meeting_participants" ADD CONSTRAINT "reunify_meeting_participants_meeting_id_reunify_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."reunify_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reunify_meeting_participants" ADD CONSTRAINT "reunify_meeting_participants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reunify_meeting_participants" ADD CONSTRAINT "reunify_meeting_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reunify_meeting_participants_meeting_user_unique" ON "reunify_meeting_participants" USING btree ("meeting_id","user_id");
