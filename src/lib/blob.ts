import { put, list, del } from "@vercel/blob";
import type { ScanState, AvailableDomain, AppConfig } from "./types";
import { DEFAULT_SCAN_STATE } from "./types";

const SCAN_STATE_KEY = "scan-state.json";
const RESULTS_KEY = "results.json";
const CONFIG_KEY = "config.json";

async function findBlob(
  prefix: string,
): Promise<{ url: string; pathname: string } | null> {
  const { blobs } = await list({ prefix });
  return blobs[0] ?? null;
}

async function readJson<T>(prefix: string): Promise<T | null> {
  const blob = await findBlob(prefix);
  if (!blob) return null;

  const res = await fetch(blob.url);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function writeJson<T>(key: string, data: T): Promise<string> {
  const existing = await findBlob(key);
  if (existing) {
    await del(existing.url);
  }

  const blob = await put(key, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
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
    const blob = await findBlob(key);
    if (blob) await del(blob.url);
  }
}
