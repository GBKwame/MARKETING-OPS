import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const [key, ...valParts] = trimmed.split("=");
          const val = valParts.join("=").replace(/^["']|["']$/g, "").trim();
          const k = key.trim();
          if (k && (!process.env[k] || process.env[k] === "")) {
            process.env[k] = val;
          }
        }
      }
    }
  } catch {}
}

type DB = MySql2Database<typeof schema>;

let activeUri: string | undefined;
let pool: mysql.Pool | undefined;
let drizzleInstance: DB | undefined;

export function getDb(): DB {
  loadEnv();
  const uri = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQLURL || "mysql://root:password@127.0.0.1:3306/marketing_pulse";

  if (!pool || activeUri !== uri) {
    if (pool) {
      try {
        pool.end();
      } catch { }
    }
    activeUri = uri;
    pool = mysql.createPool({
      uri,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    drizzleInstance = drizzle(pool, { schema, mode: "default" });
  }
  return drizzleInstance!;
}

// Proxy export for db so all queries lazily evaluate the active connection pool
export const db: DB = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance as any, prop, receiver);
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
