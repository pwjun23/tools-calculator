CREATE TABLE "wtm_complexes" (
	"sgg_cd" text NOT NULL,
	"dong" text NOT NULL,
	"apt" text NOT NULL,
	"apt_seq" text DEFAULT '' NOT NULL,
	"road_addr" text DEFAULT '' NOT NULL,
	"jibun_addr" text DEFAULT '' NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"status" text DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wtm_complexes_sgg_cd_dong_apt_pk" PRIMARY KEY("sgg_cd","dong","apt")
);
--> statement-breakpoint
CREATE INDEX "wtm_complexes_status_idx" ON "wtm_complexes" USING btree ("status");