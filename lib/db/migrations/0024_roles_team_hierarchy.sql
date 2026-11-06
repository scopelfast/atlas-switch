ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "team_members" ALTER COLUMN "role" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "invited_name" varchar(100);--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "reports_to_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL;
