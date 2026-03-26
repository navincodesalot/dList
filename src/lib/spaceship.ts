import { getConfig } from "./blob";
import type { AvailableDomain } from "./types";

const SPACESHIP_BASE = "https://spaceship.dev/api/v1";

interface SpaceshipCredentials {
  apiKey: string;
  apiSecret: string;
}

async function getCredentials(): Promise<SpaceshipCredentials> {
  const envKey = process.env.SPACESHIP_API_KEY;
  const envSecret = process.env.SPACESHIP_API_SECRET;

  if (envKey && envSecret) {
    return { apiKey: envKey, apiSecret: envSecret };
  }

  const config = await getConfig();
  if (config?.apiKey && config?.apiSecret) {
    return { apiKey: config.apiKey, apiSecret: config.apiSecret };
  }

  throw new Error(
    "Spaceship API credentials not configured. Set SPACESHIP_API_KEY and SPACESHIP_API_SECRET environment variables or configure them in Settings.",
  );
}

interface SpaceshipDomainResult {
  domain: string;
  result: "available" | "unavailable" | "error";
  premiumPricing?: {
    operation: string;
    price: number;
    currency: string;
  }[];
}

interface SpaceshipResponse {
  domains: SpaceshipDomainResult[];
}

/**
 * Check availability of up to 20 domains via the Spaceship API.
 * Returns parsed results with premium pricing info.
 */
export async function checkDomainsAvailability(
  domains: string[],
): Promise<{
  available: AvailableDomain[];
  unavailableCount: number;
  errorCount: number;
}> {
  if (domains.length === 0) {
    return { available: [], unavailableCount: 0, errorCount: 0 };
  }

  if (domains.length > 20) {
    throw new Error("Spaceship API supports max 20 domains per request");
  }

  const creds = await getCredentials();

  const res = await fetch(`${SPACESHIP_BASE}/domains/available`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": creds.apiKey,
      "X-Api-Secret": creds.apiSecret,
    },
    body: JSON.stringify({ domains }),
  });

  if (res.status === 429) {
    throw new Error("RATE_LIMITED");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spaceship API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as SpaceshipResponse;
  const now = new Date().toISOString();

  const available: AvailableDomain[] = [];
  let unavailableCount = 0;
  let errorCount = 0;

  for (const result of data.domains) {
    if (result.result === "available") {
      const registerPricing = result.premiumPricing?.find(
        (p) => p.operation === "register",
      );
      const parts = result.domain.split(".");
      const name = parts.slice(0, -1).join(".");
      const tld = parts.at(-1) ?? "";

      available.push({
        domain: result.domain,
        tld,
        length: name.length,
        isPremium: !!registerPricing,
        registerPrice: registerPricing?.price ?? null,
        currency: registerPricing?.currency ?? null,
        checkedAt: now,
      });
    } else if (result.result === "unavailable") {
      unavailableCount++;
    } else {
      errorCount++;
    }
  }

  return { available, unavailableCount, errorCount };
}
