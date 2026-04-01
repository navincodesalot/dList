import { put, del, get } from "@vercel/blob";
import type { ScanState, AvailableDomain, AppConfig } from "./types";
import { DEFAULT_SCAN_STATE } from "./types";

const SCAN_STATE_KEY = "scan-state.json";
const RESULTS_KEY = "results.json";
const CONFIG_KEY = "config.json";

/** Thrown after retries so callers don't treat a transient Blob failure as "missing data". */
export class BlobReadError extends Error {
  constructor(message = "Failed to read from blob storage") {
    super(message);
    this.name = "BlobReadError";
  }
}

async function readJson<T>(key: string): Promise<T | null> {
  let lastError: unknown;
  /** After any thrown/read failure, `get === null` may be transient — don't treat as "no blob". */
  let hadRecoverableFailure = false;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let result = await get(key, { access: "private" });

      if (result === null) {
        if (!hadRecoverableFailure) return null;
        continue;
      }

      if (result.statusCode === 304) {
        result = await get(key, { access: "private", useCache: false });
        if (result?.statusCode === 200 && result.stream != null) {
          const text = await new Response(result.stream).text();
          return JSON.parse(text) as T;
        }
      } else if (result.statusCode === 200 && result.stream != null) {
        const text = await new Response(result.stream).text();
        return JSON.parse(text) as T;
      }
    } catch (e) {
      lastError = e;
      hadRecoverableFailure = true;
    }

    await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
  }

  throw lastError instanceof Error
    ? new BlobReadError(lastError.message)
    : new BlobReadError();
}

async function writeJson<T>(key: string, data: T): Promise<string> {
  const blob = await put(key, JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}

// --- Scan State ---

export async function getScanState(): Promise<ScanState> {
  const state = await readJson<ScanState>(SCAN_STATE_KEY);
  return state ?? { ...DEFAULT_SCAN_STATE };
}

export async function setScanState(state: ScanState): Promise<void> {
  await writeJson(SCAN_STATE_KEY, state);
}

// --- Results ---

export async function getResults(): Promise<AvailableDomain[]> {
  const results = await readJson<AvailableDomain[]>(RESULTS_KEY);
  return results ?? [];
}

export async function appendResults(
  newDomains: AvailableDomain[],
): Promise<void> {
  if (newDomains.length === 0) return;
  const existing = await getResults();
  existing.push(...newDomains);
  await writeJson(RESULTS_KEY, existing);
}

export async function clearResults(): Promise<void> {
  await writeJson(RESULTS_KEY, []);
}

// --- Config ---

export async function getConfig(): Promise<AppConfig | null> {
  return readJson<AppConfig>(CONFIG_KEY);
}

export async function setConfig(config: AppConfig): Promise<void> {
  await writeJson(CONFIG_KEY, config);
}

// --- Reset ---

export async function resetAll(): Promise<void> {
  const keys = [SCAN_STATE_KEY, RESULTS_KEY];
  for (const key of keys) {
    try {
      await del(key);
    } catch {
      // ignore if not found
    }
  }
}
