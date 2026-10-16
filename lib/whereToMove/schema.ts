import { boolean, date, doublePrecision, index, integer, jsonb, pgTable, primaryKey, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import type { Settings } from "./settings";
import type { DealType } from "./types";

// ---- Better Auth 표 ----
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- whereToMove 표 ----
export const wtmSettings = pgTable("wtm_settings", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Settings>().notNull(),
  notifyEnabled: boolean("notify_enabled").notNull().default(true),
  lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wtmDeals = pgTable(
  "wtm_deals",
  {
    dealKey: text("deal_key").primaryKey(),
    type: text("type").$type<DealType>().notNull(),
    sggCd: text("sgg_cd").notNull(),
    dong: text("dong").notNull(),
    apt: text("apt").notNull(),
    area: integer("area").notNull(),
    areaRaw: real("area_raw").notNull(),
    floor: text("floor").notNull(),
    dealDate: date("deal_date").notNull(),
    amount: integer("amount").notNull(),
    rent: integer("rent").notNull(),
    renewal: boolean("renewal").notNull(),
    cancelled: boolean("cancelled").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wtm_deals_sgg_date_idx").on(t.sggCd, t.dealDate), index("wtm_deals_first_seen_idx").on(t.firstSeenAt)],
);

export const wtmNotifyLog = pgTable("wtm_notify_log", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  newCount: integer("new_count").notNull(),
  okCount: integer("ok_count").notNull(),
  status: text("status").$type<"sent" | "failed">().notNull(),
  error: text("error"),
});

/** 시·군·구 연월별 마지막 수집 시각. 로그가 없는 달은 '처음 받는 달'이다. */
export const wtmCollectLog = pgTable(
  "wtm_collect_log",
  {
    sggCd: text("sgg_cd").notNull(),
    ym: text("ym").notNull(),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sggCd, t.ym] })],
);

export type ComplexStatus = "pending" | "ok" | "notfound";

/** 단지 좌표(도로명주소 API). 키는 거래 표와 같은 (시·군·구, 동, 단지명). */
export const wtmComplexes = pgTable(
  "wtm_complexes",
  {
    sggCd: text("sgg_cd").notNull(),
    dong: text("dong").notNull(),
    apt: text("apt").notNull(),
    aptSeq: text("apt_seq").notNull().default(""),
    roadAddr: text("road_addr").notNull().default(""),
    jibunAddr: text("jibun_addr").notNull().default(""),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    status: text("status").$type<ComplexStatus>().notNull().default("pending"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sggCd, t.dong, t.apt] }), index("wtm_complexes_status_idx").on(t.status)],
);
