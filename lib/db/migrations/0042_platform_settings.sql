CREATE TABLE "platform_settings" (
	"key" varchar(96) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
