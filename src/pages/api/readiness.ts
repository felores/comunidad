import type { APIRoute } from "astro";
import { Pool } from "pg";
import { getRuntimeConfig } from "../../server/config";

export const prerender = false;

export const GET: APIRoute = async () => {
  let pool: Pool | undefined;
  try {
    const config = getRuntimeConfig();
    pool = new Pool({ connectionString: config.authDatabaseUrl, max: 1, connectionTimeoutMillis: 2_000 });
    await pool.query("select 1");
    return Response.json({ status: "ready", checks: { authDatabase: "ok" } });
  } catch {
    return Response.json({ status: "not-ready", checks: { authDatabase: "failed" } }, { status: 503 });
  } finally {
    await pool?.end();
  }
};
