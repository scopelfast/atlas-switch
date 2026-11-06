ALTER TABLE "invitations" ADD COLUMN "token_hash" varchar(64);
--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "token_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "activated_at" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_hash_unique" ON "invitations" ("token_hash") WHERE "token_hash" IS NOT NULL;
