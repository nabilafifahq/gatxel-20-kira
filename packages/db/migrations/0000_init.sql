CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE TABLE "ai_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"body" jsonb NOT NULL,
	"problems" text[] DEFAULT '{}'::text[] NOT NULL,
	"compare_ref" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"org_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"error" text,
	"provider" text,
	"model" text,
	"duration_ms" integer,
	"usage" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text,
	"mode" text NOT NULL,
	"subject" text NOT NULL,
	"title" text NOT NULL,
	"items" jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"time_limit_s" integer,
	"elapsed_s" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"score_raw" real,
	"score_max" real,
	"score_scaled" real,
	"xp" integer DEFAULT 0 NOT NULL,
	"result" jsonb,
	"code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_kind" text NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"meta" jsonb,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "badge_award" (
	"org_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"badge_id" text NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen" boolean DEFAULT false NOT NULL,
	CONSTRAINT "badge_award_learner_id_badge_id_pk" PRIMARY KEY("learner_id","badge_id")
);
--> statement-breakpoint
CREATE TABLE "competition_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"competition_id" text,
	"name" text NOT NULL,
	"subjects" text[] NOT NULL,
	"date" date,
	"date_is_estimate" boolean DEFAULT true NOT NULL,
	"registration_close" date,
	"preset_id" text,
	"link" text,
	"status" text DEFAULT 'check' NOT NULL,
	"learner_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"guardian_id" uuid,
	"recorded_by" uuid NOT NULL,
	"purpose" text NOT NULL,
	"granted" boolean NOT NULL,
	"notice_version" text NOT NULL,
	"method" text NOT NULL,
	"evidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_record" (
	"org_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"date" date NOT NULL,
	"quests_done" integer DEFAULT 0 NOT NULL,
	"quests_required" integer DEFAULT 3 NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"last_ping_at" timestamp with time zone,
	"rest" boolean DEFAULT false NOT NULL,
	CONSTRAINT "day_record_learner_id_date_pk" PRIMARY KEY("learner_id","date")
);
--> statement-breakpoint
CREATE TABLE "deletion_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"reference" text NOT NULL,
	"scheduled_for" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"executed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"learner_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"registered_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "guardian_link" (
	"org_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"relation" text DEFAULT 'orang tua' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guardian_link_guardian_id_learner_id_pk" PRIMARY KEY("guardian_id","learner_id")
);
--> statement-breakpoint
CREATE TABLE "import_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"grade" smallint NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"media_id" uuid NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pages" text[] DEFAULT '{}'::text[] NOT NULL,
	"error" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"learner_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"result" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "learner_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"avatar" text DEFAULT 'fox' NOT NULL,
	"grade" smallint NOT NULL,
	"screen_limit_min" integer DEFAULT 60 NOT NULL,
	"rest_weekdays" integer[] DEFAULT '{0}'::int[] NOT NULL,
	"review_enabled" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"started_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."learner_secret" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"pin_hash" text NOT NULL,
	"failed_pins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."login_attempt" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"success" boolean NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."mcp_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "mcp_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"learner_id" uuid,
	"kind" text NOT NULL,
	"path" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "member_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"skill_id" text NOT NULL,
	"subject" text NOT NULL,
	"grade" smallint NOT NULL,
	"body" jsonb NOT NULL,
	"source" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"collection" text,
	"position" integer,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "outbox_email" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"to_addr" text NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"text" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "paper" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"grade" smallint NOT NULL,
	"minutes" integer NOT NULL,
	"mode" text NOT NULL,
	"preset_id" text,
	"item_refs" text[] NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"public_key" "bytea" NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" text[] DEFAULT '{}'::text[] NOT NULL,
	"device_type" text,
	"backed_up" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plan_slot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"plan_week_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"date" date NOT NULL,
	"subject" text NOT NULL,
	"kind" text NOT NULL,
	"skill_id" text,
	"paper_id" uuid,
	"mode" text DEFAULT 'latihan' NOT NULL,
	"question_count" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_week" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "problem_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"learner_id" uuid,
	"reporter_id" uuid NOT NULL,
	"item_ref" text NOT NULL,
	"reason" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"reference" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid
);
--> statement-breakpoint
CREATE TABLE "quest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"date" date NOT NULL,
	"subject" text NOT NULL,
	"kind" text NOT NULL,
	"skill_id" text,
	"paper_id" uuid,
	"mode" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"attempt_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."reset_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reset_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"attempt_no" integer DEFAULT 1 NOT NULL,
	"item_ref" text NOT NULL,
	"skill_id" text NOT NULL,
	"subject" text NOT NULL,
	"item_type" text NOT NULL,
	"difficulty" smallint NOT NULL,
	"answer" jsonb,
	"status" text NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"max_score" real DEFAULT 1 NOT NULL,
	"hints_used" integer DEFAULT 0 NOT NULL,
	"time_ms" integer DEFAULT 0 NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"client_id" text NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"graded_by" uuid,
	"graded_at" timestamp with time zone,
	"rubric_scores" integer[],
	"feedback" text,
	"ai_suggestion" jsonb,
	"media_id" uuid
);
--> statement-breakpoint
CREATE TABLE "rest_day" (
	"org_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"date" date NOT NULL,
	"rest" boolean NOT NULL,
	CONSTRAINT "rest_day_learner_id_date_pk" PRIMARY KEY("learner_id","date")
);
--> statement-breakpoint
CREATE TABLE "review_card" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"item_ref" text NOT NULL,
	"skill_id" text NOT NULL,
	"subject" text NOT NULL,
	"card" jsonb NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"retired" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_state" (
	"name" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_result" text
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"device_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "skill_state" (
	"org_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"skill_id" text NOT NULL,
	"theta" real DEFAULT 0 NOT NULL,
	"n_answers" integer DEFAULT 0 NOT NULL,
	"recent" real[] DEFAULT '{}'::real[] NOT NULL,
	"gate" text DEFAULT 'new' NOT NULL,
	"stars" smallint DEFAULT 0 NOT NULL,
	"last_practiced" date,
	"lesson_done_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_state_learner_id_skill_id_pk" PRIMARY KEY("learner_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "auth"."user_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"role" text NOT NULL,
	"email" text,
	"name" text NOT NULL,
	"password_hash" text,
	"password_changed_at" timestamp with time zone,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."webauthn_challenge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"challenge" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "week_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"note" text,
	"data" jsonb NOT NULL,
	"sent_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"ref" text,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_job_id_ai_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."ai_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."learner_secret" ADD CONSTRAINT "learner_secret_user_id_user_account_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."mcp_token" ADD CONSTRAINT "mcp_token_user_id_user_account_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."passkey" ADD CONSTRAINT "passkey_user_id_user_account_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_slot" ADD CONSTRAINT "plan_slot_plan_week_id_plan_week_id_fk" FOREIGN KEY ("plan_week_id") REFERENCES "public"."plan_week"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."reset_token" ADD CONSTRAINT "reset_token_user_id_user_account_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response" ADD CONSTRAINT "response_attempt_id_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_account_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempt_learner_idx" ON "attempt" USING btree ("learner_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_code_uq" ON "attempt" USING btree ("org_id","code");--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_log" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "consent_learner_idx" ON "consent_event" USING btree ("learner_id","purpose","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "device_token_uq" ON "auth"."device" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "device_org_idx" ON "auth"."device" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "job_queue_idx" ON "job" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "learner_profile_org_idx" ON "learner_profile" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "login_attempt_key_idx" ON "auth"."login_attempt" USING btree ("key","at");--> statement-breakpoint
CREATE INDEX "member_profile_org_idx" ON "member_profile" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "org_item_skill_idx" ON "org_item" USING btree ("org_id","skill_id");--> statement-breakpoint
CREATE INDEX "org_item_collection_idx" ON "org_item" USING btree ("org_id","collection","position");--> statement-breakpoint
CREATE UNIQUE INDEX "paper_code_uq" ON "paper" USING btree ("org_id","code");--> statement-breakpoint
CREATE INDEX "passkey_user_idx" ON "auth"."passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "plan_slot_learner_date_idx" ON "plan_slot" USING btree ("learner_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_week_uq" ON "plan_week" USING btree ("learner_id","week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "quest_day_uq" ON "quest" USING btree ("learner_id","date","subject","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "response_client_uq" ON "response" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "response_slot_uq" ON "response" USING btree ("attempt_id","position","attempt_no");--> statement-breakpoint
CREATE INDEX "response_learner_skill_idx" ON "response" USING btree ("learner_id","skill_id","answered_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_card_uq" ON "review_card" USING btree ("learner_id","item_ref");--> statement-breakpoint
CREATE INDEX "review_card_due_idx" ON "review_card" USING btree ("learner_id","due_at");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "auth"."session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_account_email_uq" ON "auth"."user_account" USING btree (lower("email")) WHERE "auth"."user_account"."email" is not null;--> statement-breakpoint
CREATE INDEX "user_account_org_idx" ON "auth"."user_account" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "week_report_uq" ON "week_report" USING btree ("learner_id","week_start");--> statement-breakpoint
CREATE INDEX "xp_event_learner_idx" ON "xp_event" USING btree ("learner_id","date");