import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// 요청 사이에 Fluid Compute 인스턴스가 재사용되므로 Pool 하나를 모듈 수준에서 공유한다.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

export const db = drizzle(pool, { schema });
