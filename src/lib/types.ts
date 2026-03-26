export interface ScanState {
  status: "idle" | "running" | "paused" | "completed" | "error";
  offset: number;
  total: number;
  availableCount: number;
  unavailableCount: number;
  errorCount: number;
  startedAt: string | null;
  updatedAt: string | null;
}

export interface AvailableDomain {
  domain: string;
  tld: string;
  length: number;
  isPremium: boolean;
  registerPrice: number | null;
  currency: string | null;
  checkedAt: string;
}

export interface AppConfig {
  apiKey: string;
  apiSecret: string;
}

export const DEFAULT_SCAN_STATE: ScanState = {
  status: "idle",
  offset: 0,
  total: 0,
  availableCount: 0,
  unavailableCount: 0,
  errorCount: 0,
  startedAt: null,
  updatedAt: null,
};
