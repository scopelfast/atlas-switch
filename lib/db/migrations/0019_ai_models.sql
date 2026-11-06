CREATE TABLE "ai_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"provider" varchar(80) NOT NULL,
	"type" varchar(40) NOT NULL,
	"status" varchar(20) DEFAULT 'PAUSADO' NOT NULL,
	"endpoint" text,
	"model_id" varchar(120),
	"is_default" boolean DEFAULT false NOT NULL,
	"is_open_source" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
