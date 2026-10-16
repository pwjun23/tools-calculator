CREATE TABLE "wtm_collect_log" (
	"sgg_cd" text NOT NULL,
	"ym" text NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wtm_collect_log_sgg_cd_ym_pk" PRIMARY KEY("sgg_cd","ym")
);
--> statement-breakpoint
-- 거래 키 앞에 시·군·구 코드를 붙인다(여러 지역에서 같은 동·단지 이름이 겹치지 않게).
UPDATE "wtm_deals" SET "deal_key" = "sgg_cd" || '|' || "deal_key" WHERE "deal_key" NOT LIKE "sgg_cd" || '|%';--> statement-breakpoint
-- 이미 받은 달을 기록해, 그 달의 새 거래가 '처음 받는 달'(계약일 시각)로 들어가지 않게 한다.
INSERT INTO "wtm_collect_log" ("sgg_cd", "ym", "collected_at")
SELECT DISTINCT "sgg_cd", to_char("deal_date", 'YYYYMM'), now() FROM "wtm_deals"
ON CONFLICT DO NOTHING;
