import { getMigrations } from "better-auth/db/migration";
import { createAuthOptions } from "../src/server/auth.ts";

const migration = await getMigrations(createAuthOptions());
await migration.runMigrations();
console.log("Better Auth tables are current in the isolated auth database.");
