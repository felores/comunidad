import { betterAuth, type BetterAuthOptions } from "better-auth";
import { jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { Pool } from "pg";
import { getRuntimeConfig } from "./config";
import {
  createEmailProvider,
  passwordResetMessage,
  type TransactionalEmailProvider,
  verificationMessage,
} from "./email";

type AuthDependencies = {
  pool?: Pool;
  email?: TransactionalEmailProvider;
};

export function createAuthOptions(dependencies: AuthDependencies = {}): BetterAuthOptions {
  const config = getRuntimeConfig();
  const pool = dependencies.pool ?? new Pool({
    connectionString: config.authDatabaseUrl,
    max: 10,
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 30_000,
    application_name: "sociedad-paralela-auth",
  });
  const email = dependencies.email ?? createEmailProvider();

  return {
    appName: "Sociedad Paralela",
    baseURL: config.appUrl,
    secret: config.authSecret,
    trustedOrigins: [config.appUrl],
    disabledPaths: ["/token"],
    database: pool,
    user: {
      additionalFields: {
        source: { type: "string", required: false, input: true },
        campaign: { type: "string", required: false, input: true },
        content: { type: "string", required: false, input: true },
        leadMagnet: { type: "string", required: false, input: true },
      },
    },
    advanced: {
      useSecureCookies: config.production,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.production,
        path: "/",
      },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      requireEmailVerification: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, url, token }) {
        await email.send(passwordResetMessage(user.email, url, token));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      async sendVerificationEmail({ user, url, token }) {
        await email.send(verificationMessage(user.email, url, token));
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 30,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 12,
      customRules: {
        "/sign-in/email": { window: 60, max: 6 },
        "/sign-up/email": { window: 60, max: 4 },
        "/request-password-reset": { window: 60, max: 4 },
      },
    },
    plugins: [
      jwt(),
      oauthProvider({
        loginPage: "/ingresar",
        consentPage: "/oauth/consent",
        scopes: ["openid", "profile"],
        clientPrivileges: async ({ action, user }) => (
          (action === "create" || action === "delete") &&
          Boolean(user?.emailVerified) &&
          Boolean(process.env.REMARK42_OAUTH_PROVISIONER_USER_ID) &&
          user?.id === process.env.REMARK42_OAUTH_PROVISIONER_USER_ID
        ),
      }),
    ],
  };
}

export function createAuth(dependencies: AuthDependencies = {}) {
  return betterAuth(createAuthOptions(dependencies));
}

let singleton: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  singleton ??= createAuth();
  return singleton;
}

export type AuthInstance = ReturnType<typeof createAuth>;
