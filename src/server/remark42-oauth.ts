type OAuthClientCreator = {
  api: {
    adminCreateOAuthClient(input: {
      headers: Headers;
      body: {
        redirect_uris: string[];
        scope: string;
        client_name: string;
        client_uri: string;
        token_endpoint_auth_method: "client_secret_basic";
        application_type: "web" | "native";
        grant_types: ["authorization_code"];
        response_types: ["code"];
        skip_consent: true;
        require_pkce: false;
      };
    }): Promise<{
      client_id: string;
      client_secret?: string;
    }>;
  };
};

type OAuthClientLifecycle = OAuthClientCreator & {
  api: OAuthClientCreator["api"] & {
    deleteOAuthClient(input: { headers: Headers; body: { client_id: string } }): Promise<unknown>;
    signOut(input: { headers: Headers }): Promise<unknown>;
  };
};

export function remark42OAuthRedirectUrl(publicUrl: string, providerName: string): string {
  return `${publicUrl.replace(/\/$/, "")}/auth/${encodeURIComponent(providerName)}/callback`;
}

export async function createRemark42OAuthClient(
  auth: OAuthClientCreator,
  input: { publicUrl: string; providerName: string; headers: Headers },
) {
  const publicUrl = new URL(input.publicUrl);
  if (publicUrl.pathname.replace(/\/$/, "") !== "/comentarios") {
    throw new Error("Remark42 OAuth client requires the /comentarios public path");
  }
  return auth.api.adminCreateOAuthClient({
    headers: input.headers,
    body: {
      redirect_uris: [remark42OAuthRedirectUrl(publicUrl.href, input.providerName)],
      scope: "openid profile",
      client_name: "Sociedad Paralela Remark42",
      client_uri: publicUrl.href.replace(/\/$/, ""),
      token_endpoint_auth_method: "client_secret_basic",
      application_type: publicUrl.protocol === "https:" ? "web" : "native",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      skip_consent: true,
      require_pkce: false,
    },
  });
}

export async function deleteRemark42OAuthClient(
  auth: OAuthClientLifecycle,
  input: { clientId: string; headers: Headers },
) {
  return auth.api.deleteOAuthClient({
    headers: input.headers,
    body: { client_id: input.clientId },
  });
}

export async function revokeRemark42ProvisionerSession(auth: OAuthClientLifecycle, headers: Headers) {
  return auth.api.signOut({ headers });
}
