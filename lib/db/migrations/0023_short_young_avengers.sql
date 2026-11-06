ALTER TABLE "activity_logs" ALTER COLUMN "timestamp" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activity_logs" ALTER COLUMN "timestamp" SET DEFAULT now();