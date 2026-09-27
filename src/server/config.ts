export type RuntimeConfig = {
  appUrl: string;
  authDatabaseUrl: string;
  authSecret: string;
  production: boolean;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required server configuration: ${name}`);
  return value;
}

function asHttpUrl(name: string, value: string): string {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use http or https`);
  }
  return parsed.origin;
}

export function getRuntimeConfig(): RuntimeConfig {
  const production = process.env.NODE_ENV === "production";
  const appUrl = asHttpUrl(
    "BETTER_AUTH_URL",
    required("BETTER_AUTH_URL"),
  );
  if (production && !appUrl.startsWith("https://")) {
    throw new Error("BETTER_AUTH_URL must use https in production");
  }

  const authSecret = required("BETTER_AUTH_SECRET");
  if (authSecret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
  }

  return {
    appUrl,
    authDatabaseUrl: required("AUTH_DATABASE_URL"),
    authSecret,
    production,
  };
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
