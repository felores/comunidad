import { Pool } from "pg";
import { createAuth, createAuthOptions } from "../src/server/auth.ts";
import { MemoryEmailProvider } from "../src/server/email.ts";
import {
  createRemark42OAuthClient,
  deleteRemark42OAuthClient,
  revokeRemark42ProvisionerSession,
} from "../src/server/remark42-oauth.ts";
import {
  assertApprovedAuthSchema,
  cleanupOAuthProvisioningFailure,
  deliverOAuthSecret,
} from "./oauth-handoff.mjs";

const publicUrl = process.env.REMARK42_URL?.trim();
const providerName = process.env.REMARK42_PROVIDER_NAME?.trim();
const sessionCookie = process.env.REMARK42_OAUTH_PROVISIONER_SESSION_COOKIE?.trim();
const secretFifo = process.env.REMARK42_OAUTH_SECRET_FIFO?.trim();
const resultFifo = process.env.REMARK42_OAUTH_RESULT_FIFO?.trim();
const handoffId = process.env.HANDOFF_ID?.trim();
const deadlineEpoch = Number(process.env.HANDOFF_DEADLINE_EPOCH);
const readyGroupId = Number(process.env.HANDOFF_SHARED_GID);
if (
  !publicUrl ||
  !providerName ||
  !sessionCookie ||
  !process.env.REMARK42_OAUTH_PROVISIONER_USER_ID ||
  !secretFifo ||
  !resultFifo ||
  !handoffId ||
  !Number.isInteger(deadlineEpoch) ||
  !Number.isInteger(readyGroupId)
) {
  throw new Error("Set the approved Remark42 provisioner identity and ephemeral FIFO handoff configuration");
}

const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
const email = new MemoryEmailProvider();
const headers = new Headers({ cookie: sessionCookie });
let auth;
let client;
let handoffSucceeded = false;
try {
  await assertApprovedAuthSchema(pool);
  createAuthOptions({ pool, email });
  auth = createAuth({ pool, email });
  client = await createRemark42OAuthClient(auth, {
    publicUrl,
    providerName,
    headers,
  });
  if (!client.client_secret) throw new Error("Better Auth did not return a client secret");
  await deliverOAuthSecret({
    secret: client.client_secret,
    clientId: client.client_id,
    secretFifo,
    resultFifo,
    handoffId,
    deadlineEpoch,
    readyGroupId,
  });
  client.client_secret = undefined;
  handoffSucceeded = true;
  await revokeRemark42ProvisionerSession(auth, headers);
  console.log(`Remark42 OAuth handoff completed for client ${client.client_id}.`);
} catch (error) {
  await cleanupOAuthProvisioningFailure({
    cause: error,
    clientId: client?.client_id,
    handoffSucceeded,
    deleteClient: auth && client?.client_id
      ? async () => deleteRemark42OAuthClient(auth, { clientId: client.client_id, headers })
      : undefined,
    revokeSession: auth
      ? async () => revokeRemark42ProvisionerSession(auth, headers)
      : undefined,
  });
} finally {
  await pool.end();
}
