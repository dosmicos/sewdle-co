export type AddiEnvironment = "production" | "staging";

export type AddiCredentials = {
  clientId: string;
  clientSecret: string;
  allySlug?: string;
  storeId?: string;
  callbackUsername?: string;
  callbackPassword?: string;
  environment: AddiEnvironment;
};

export type AddiCredentialSource = {
  orgCredentials?: Record<string, unknown> | null;
  env?: Record<string, string | undefined>;
};

export type AddiPaymentLineItem = {
  sku?: string;
  name: string;
  amount: number;
  category?: string;
};

export type AddiPayLinkPayload = {
  client: {
    idType: "CC";
    idNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    cellphone: string;
    cellphoneCountryCode: "+57";
    shippingAddress: AddiAddressPayload;
    billingAddress: AddiAddressPayload;
  };
  ally: {
    storeId?: string;
    callbackUrl: string;
    callbackRequired: boolean;
  };
  order: {
    orderId: string;
    totalAmount: string;
    shippingAmount: string;
    totalTaxesAmount?: string;
    currency: "COP";
    description?: string;
    items?: AddiPaymentLineItemPayload[];
  };
  sale?: {
    seller?: Record<string, unknown>;
  };
};

type AddiAddressPayload = {
  address: string;
  number: string;
  complement?: string;
  city: string;
  state: string;
  country: "CO";
  zipcode?: string;
  cellphoneCountryCode?: "+57";
  cellphone?: string;
};

type AddiPaymentLineItemPayload = {
  sku?: string;
  name: string;
  amount: string;
  category?: string;
};

export type AddiPayLinkResponse = {
  orderId?: string;
  applicationId?: string;
  paymentUrl?: string;
};

function envValue(
  env: Record<string, string | undefined>,
  names: string[],
): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function credentialValue(
  credentials: Record<string, unknown> | null | undefined,
  names: string[],
): string | undefined {
  if (!credentials) return undefined;
  for (const name of names) {
    const value = credentials[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function getAddiCredentials(
  source: AddiCredentialSource,
): AddiCredentials {
  const env = source.env || {};
  const orgCredentials = source.orgCredentials || undefined;
  const environment =
    (credentialValue(orgCredentials, ["environment", "env"]) ||
        envValue(env, ["ADDI_ENVIRONMENT", "ADDI_ENV"]) || "production")
        .toLowerCase() ===
        "staging"
      ? "staging"
      : "production";

  return {
    clientId: credentialValue(orgCredentials, ["client_id", "clientId"]) ||
      envValue(env, ["ADDI_CLIENT_ID"]) || "",
    clientSecret:
      credentialValue(orgCredentials, ["client_secret", "clientSecret"]) ||
      envValue(env, ["ADDI_CLIENT_SECRET"]) || "",
    allySlug: credentialValue(orgCredentials, ["ally_slug", "allySlug"]) ||
      envValue(env, ["ADDI_ALLY_SLUG"]),
    storeId: credentialValue(orgCredentials, ["store_id", "storeId"]) ||
      envValue(env, ["ADDI_STORE_ID"]),
    callbackUsername: credentialValue(orgCredentials, [
      "callback_username",
      "callbackUsername",
    ]) || envValue(env, ["ADDI_CALLBACK_USERNAME"]),
    callbackPassword: credentialValue(orgCredentials, [
      "callback_password",
      "callbackPassword",
    ]) || envValue(env, ["ADDI_CALLBACK_PASSWORD"]),
    environment,
  };
}

export function addiAuthUrl(environment: AddiEnvironment): string {
  return environment === "staging"
    ? "https://auth.addi-staging.com/oauth/token"
    : "https://auth.addi.com/oauth/token";
}

export function addiAudience(environment: AddiEnvironment): string {
  return environment === "staging"
    ? "https://api.staging.addi.com"
    : "https://api.addi.com";
}

export function addiPayLinkBaseUrl(environment: AddiEnvironment): string {
  return environment === "staging"
    ? "https://pay-link-custom.addi-staging.com"
    : "https://pay-link-custom.addi.com";
}

export function addiConfigUrl(params: {
  allySlug: string;
  requestedAmount: number;
}): string {
  return `https://channels-public-api.addi.com/allies/${
    encodeURIComponent(params.allySlug)
  }/config?requestedAmount=${
    encodeURIComponent(String(Math.round(params.requestedAmount)))
  }`;
}

export function splitCustomerName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.slice(0, Math.max(1, parts.length - 1)).join(" ") ||
      "Cliente",
    lastName: parts.length > 1 ? parts[parts.length - 1] : "Dosmicos",
  };
}

export function cleanColombianPhone(value: string): string {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("57") && digits.length > 10) digits = digits.slice(2);
  return digits;
}

export function buildAddiPayLinkPayload(params: {
  orderId: string;
  totalAmount: number;
  shippingAmount: number;
  description?: string;
  client: {
    idNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    cellphone: string;
    address: string;
    city: string;
    state: string;
    complement?: string;
  };
  lineItems?: AddiPaymentLineItem[];
  ally: {
    storeId?: string;
    callbackUrl: string;
    callbackRequired?: boolean;
  };
  sale?: AddiPayLinkPayload["sale"];
}): AddiPayLinkPayload {
  const phone = cleanColombianPhone(params.client.cellphone);
  const address: AddiAddressPayload = {
    address: params.client.address,
    number: params.client.address,
    complement: params.client.complement,
    city: params.client.city,
    state: params.client.state,
    country: "CO",
    cellphoneCountryCode: "+57",
    cellphone: phone,
  };

  return {
    client: {
      idType: "CC",
      idNumber: String(params.client.idNumber || "").replace(/\D/g, ""),
      firstName: params.client.firstName,
      lastName: params.client.lastName,
      email: params.client.email,
      cellphone: phone,
      cellphoneCountryCode: "+57",
      shippingAddress: address,
      billingAddress: address,
    },
    ally: {
      ...(params.ally.storeId ? { storeId: params.ally.storeId } : {}),
      callbackUrl: params.ally.callbackUrl,
      callbackRequired: params.ally.callbackRequired !== false,
    },
    order: {
      orderId: params.orderId,
      totalAmount: String(Math.round(params.totalAmount)),
      shippingAmount: String(Math.round(params.shippingAmount)),
      currency: "COP",
      ...(params.description
        ? { description: params.description.slice(0, 180) }
        : {}),
      ...(params.lineItems?.length
        ? {
          items: params.lineItems.map((item) => ({
            ...(item.sku ? { sku: item.sku } : {}),
            name: item.name,
            amount: String(Math.round(item.amount)),
            ...(item.category ? { category: item.category } : {}),
          })),
        }
        : {}),
    },
    ...(params.sale ? { sale: params.sale } : {}),
  };
}

export function parseAddiPayLinkResponse(
  data: Record<string, unknown>,
): AddiPayLinkResponse {
  return {
    orderId: typeof data.orderId === "string" ? data.orderId : undefined,
    applicationId: typeof data.applicationId === "string"
      ? data.applicationId
      : typeof data.ApplicationID === "string"
      ? data.ApplicationID
      : undefined,
    paymentUrl: typeof data.paymentLink === "string"
      ? data.paymentLink
      : typeof data.paymentUrl === "string"
      ? data.paymentUrl
      : undefined,
  };
}

export function parseAddiCallbackAuthorization(
  authorizationHeader: string | null,
  expectedUsername: string,
  expectedPassword: string,
): boolean {
  if (!authorizationHeader?.startsWith("Basic ")) return false;
  try {
    const decoded = atob(authorizationHeader.slice("Basic ".length).trim());
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return username === expectedUsername && password === expectedPassword;
  } catch {
    return false;
  }
}

export async function requestAddiAccessToken(params: {
  credentials: AddiCredentials;
  fetcher?: typeof fetch;
}): Promise<string> {
  const fetcher = params.fetcher || fetch;
  const response = await fetcher(addiAuthUrl(params.credentials.environment), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audience: addiAudience(params.credentials.environment),
      grant_type: "client_credentials",
      client_id: params.credentials.clientId,
      client_secret: params.credentials.clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Addi auth failed with HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!data?.access_token) throw new Error("Addi auth response missing token");
  return String(data.access_token);
}

export async function createAddiPayLink(params: {
  credentials: AddiCredentials;
  payload: AddiPayLinkPayload;
  fetcher?: typeof fetch;
}): Promise<AddiPayLinkResponse> {
  const fetcher = params.fetcher || fetch;
  const token = await requestAddiAccessToken({
    credentials: params.credentials,
    fetcher,
  });
  const response = await fetcher(
    `${addiPayLinkBaseUrl(params.credentials.environment)}/v1/custom/pay-link`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(params.payload),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Addi paylink failed with HTTP ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  return parseAddiPayLinkResponse(await response.json());
}
