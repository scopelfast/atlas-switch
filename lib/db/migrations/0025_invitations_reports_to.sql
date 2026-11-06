ALTER TABLE "invitations" ADD COLUMN "reports_to_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL;
