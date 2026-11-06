CREATE TABLE "billtrak_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" varchar(20) NOT NULL,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billtrak_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billtrak_bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"category_id" integer,
	"project_id" integer,
	"status" varchar(20) DEFAULT 'PENDENTE' NOT NULL,
	"amount_cents" integer NOT NULL,
	"due_date" date NOT NULL,
	"paid_at" date,
	"recurring" boolean DEFAULT false NOT NULL,
	"recurrence_rule" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billtrak_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"account_id" integer,
	"bill_id" integer,
	"type" varchar(20) NOT NULL,
	"description" varchar(200) NOT NULL,
	"amount_cents" integer NOT NULL,
	"occurred_at" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billtrak_accounts" ADD CONSTRAINT "billtrak_accounts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billtrak_bills" ADD CONSTRAINT "billtrak_bills_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billtrak_bills" ADD CONSTRAINT "billtrak_bills_category_id_billtrak_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."billtrak_categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billtrak_bills" ADD CONSTRAINT "billtrak_bills_project_id_projectus_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projectus_projects"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billtrak_transactions" ADD CONSTRAINT "billtrak_transactions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billtrak_transactions" ADD CONSTRAINT "billtrak_transactions_account_id_billtrak_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."billtrak_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billtrak_transactions" ADD CONSTRAINT "billtrak_transactions_bill_id_billtrak_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."billtrak_bills"("id") ON DELETE set null ON UPDATE no action;
