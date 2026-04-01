"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_SCAN_STATE, type ScanState } from "@/lib/types";
import type { AvailableDomain } from "@/lib/types";

function mergeScanState(data: unknown): ScanState {
  if (!data || typeof data !== "object" || !("status" in data)) {
    return { ...DEFAULT_SCAN_STATE };
  }
  const partial = data as Partial<ScanState>;
  const defined = Object.fromEntries(
    Object.entries(partial).filter(([, v]) => v !== undefined),
  ) as Partial<ScanState>;
  return { ...DEFAULT_SCAN_STATE, ...defined };
}

const MAX_RETRIES = 5;
/** Keep in sync with `BATCH_SIZE` in `api/scan/batch`. */
const DOMAINS_PER_SCAN_BATCH = 20;
const SAVE_EVERY_N_BATCHES = 50;
const SCAN_BATCH_GAP_MS = 1100;

/** Rough round-trip time per batch: gap after each request + typical API latency. */
function estimateRemainingScanMs(remainingBatches: number): number {
  return remainingBatches * (SCAN_BATCH_GAP_MS + 350);
}

function formatShortDuration(ms: number): string {
  const sec = Math.max(1, Math.round(ms / 1000));
  if (sec < 90) return `~${sec}s`;
  return `~${Math.ceil(sec / 60)} min`;
}

/** Browser local timezone (user's clock); includes short TZ abbreviation. */
function formatLocalSaveTime(date = new Date()): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

export function ScanControls() {
  const [state, setState] = useState<ScanState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [lastSaveInfo, setLastSaveInfo] = useState<string | null>(null);
  const [batchesSinceLastSave, setBatchesSinceLastSave] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const scanRef = useRef(false);
  const scanLoopActiveRef = useRef(false);
  const retryCountRef = useRef(0);

  const pendingDomainsRef = useRef<AvailableDomain[]>([]);
  const localStateRef = useRef<ScanState>({ ...DEFAULT_SCAN_STATE });
  const batchesSinceLastSaveRef = useRef(0);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/scan/state");
      const raw = await res.json();
      const data = mergeScanState(raw);
      setState(data);
      localStateRef.current = { ...data };
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  // --- beforeunload: warn if unsaved data ---
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingDomainsRef.current.length > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const flushToBlob = useCallback(async () => {
    const domains = pendingDomainsRef.current;
    const st = { ...localStateRef.current };
    if (domains.length === 0 && !scanRef.current) {
      await fetch("/api/scan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: [], state: st }),
      });
      setUnsavedCount(0);
      batchesSinceLastSaveRef.current = 0;
      return;
    }

    const toSave = [...domains];
    pendingDomainsRef.current = [];

    setIsSaving(true);
    try {
      const res = await fetch("/api/scan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: toSave, state: st }),
      });
      if (!res.ok) throw new Error("Save failed");
      setUnsavedCount(0);
      batchesSinceLastSaveRef.current = 0;
      setLastSaveInfo(
        toSave.length > 0
          ? `Saved ${toSave.length.toLocaleString()} available domain${toSave.length !== 1 ? "s" : ""} at ${formatLocalSaveTime()}`
          : `Progress saved at ${formatLocalSaveTime()}`,
      );
    } catch {
      pendingDomainsRef.current.push(...toSave);
      setUnsavedCount(pendingDomainsRef.current.length);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const runScanLoop = useCallback(async () => {
    if (scanLoopActiveRef.current) return;
    scanLoopActiveRef.current = true;
    scanRef.current = true;
    setIsScanning(true);
    setError(null);
    retryCountRef.current = 0;
    batchesSinceLastSaveRef.current = 0;
    setBatchesSinceLastSave(0);

    try {
      while (scanRef.current) {
        const offset = localStateRef.current.offset;

        try {
          const res = await fetch("/api/scan/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ offset }),
          });

          if (res.status === 429) {
            if (retryCountRef.current >= MAX_RETRIES) {
              setError(
                "Rate limited by Spaceship API — max retries reached. Try starting again later.",
              );
              scanRef.current = false;
              break;
            }
            retryCountRef.current++;
            const backoff = Math.min(retryCountRef.current * 2000, 30000);
            setError(
              `Rate limited — retrying in ${Math.ceil(backoff / 1000)}s... (${retryCountRef.current}/${MAX_RETRIES})`,
            );
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }

          if (!res.ok) {
            const data = (await res.json()) as {
              error: string;
              retryable?: boolean;
            };
            if (
              data.retryable !== false &&
              retryCountRef.current < MAX_RETRIES
            ) {
              retryCountRef.current++;
              const backoff = Math.min(retryCountRef.current * 2000, 15000);
              setError(
                `${data.error} — retrying (${retryCountRef.current}/${MAX_RETRIES})...`,
              );
              await new Promise((r) => setTimeout(r, backoff));
              continue;
            }
            setError(data.error);
            scanRef.current = false;
            break;
          }

          retryCountRef.current = 0;
          setError(null);

          const data = (await res.json()) as {
            available: AvailableDomain[];
            unavailableCount: number;
            errorCount: number;
            batchSize: number;
            total: number;
            done: boolean;
          };

          // Accumulate in client memory
          if (data.available.length > 0) {
            pendingDomainsRef.current.push(...data.available);
          }

          const st = localStateRef.current;
          st.offset += data.batchSize;
          st.total = data.total;
          st.availableCount += data.available.length;
          st.unavailableCount += data.unavailableCount;
          st.errorCount += data.errorCount;
          st.updatedAt = new Date().toISOString();

          if (data.done) {
            st.status = "completed";
          }

          setUnsavedCount(pendingDomainsRef.current.length);
          setState({ ...st });

          batchesSinceLastSaveRef.current++;
          setBatchesSinceLastSave(batchesSinceLastSaveRef.current);

          // Periodic save or final save
          if (
            data.done ||
            batchesSinceLastSaveRef.current >= SAVE_EVERY_N_BATCHES
          ) {
            await flushToBlob();
            setBatchesSinceLastSave(0);
          }

          if (data.done) {
            scanRef.current = false;
            break;
          }

          await new Promise((r) => setTimeout(r, SCAN_BATCH_GAP_MS));
        } catch (err) {
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++;
            const backoff = Math.min(retryCountRef.current * 2000, 15000);
            setError(
              `Network error — retrying (${retryCountRef.current}/${MAX_RETRIES})...`,
            );
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          setError(err instanceof Error ? err.message : "Network error");
          scanRef.current = false;
          break;
        }
      }

      // Flush any remaining unsaved data when the loop ends
      if (pendingDomainsRef.current.length > 0) {
        await flushToBlob();
        setBatchesSinceLastSave(0);
      }
    } finally {
      scanLoopActiveRef.current = false;
      setIsScanning(false);
    }
  }, [flushToBlob]);

  const handleStart = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scan/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const raw = await res.json();
      if (!res.ok) {
        const err = raw as { error?: string };
        setError(err.error ?? "Failed to start scan");
        return;
      }
      const s = mergeScanState(raw);
      setState(s);
      localStateRef.current = { ...s };
      pendingDomainsRef.current = [];
      setUnsavedCount(0);
      setLastSaveInfo(null);
      void runScanLoop();
    } catch {
      setError("Failed to start scan");
    } finally {
      setIsLoading(false);
    }
  };

  const progress =
    state && state.total > 0 ? (state.offset / state.total) * 100 : 0;

  const etaMinutes =
    isScanning && state && state.offset > 0
      ? Math.round(((state.total - state.offset) / 20) * 1.1) / 60
      : null;

  const notAvailableCount =
    state != null ? state.unavailableCount + state.errorCount : 0;
  const scannedPct =
    state != null && state.total > 0
      ? (state.offset / state.total) * 100
      : null;
  const availableOfCheckedPct =
    state != null && state.offset > 0
      ? (state.availableCount / state.offset) * 100
      : null;

  const batchesUntilNextSave = Math.max(
    1,
    SAVE_EVERY_N_BATCHES - batchesSinceLastSave,
  );
  const domainsUntilNextSave = batchesUntilNextSave * DOMAINS_PER_SCAN_BATCH;
  const nextSaveEta = formatShortDuration(
    estimateRemainingScanMs(batchesUntilNextSave),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          onClick={handleStart}
          disabled={isLoading || isScanning || state?.status === "completed"}
          size="sm"
        >
          {state?.status === "completed" ? "Completed" : "Start Scan"}
        </Button>

        {/* Save status */}
        {(isSaving || unsavedCount > 0) && (
          <div className="flex items-center gap-2">
            {isSaving && (
              <Badge
                variant="secondary"
                className="animate-pulse text-xs font-normal"
              >
                Saving…
              </Badge>
            )}
            {!isSaving && unsavedCount > 0 && (
              <Badge
                variant="outline"
                className="text-xs font-normal"
                title="Only available hits are persisted to blob; names that are not available are not stored."
              >
                {unsavedCount.toLocaleString()} unsaved available{" "}
                {unsavedCount === 1 ? "domain" : "domains"}
              </Badge>
            )}
          </div>
        )}
        {lastSaveInfo && (
          <span
            className="text-muted-foreground text-xs"
            title="Time is shown in your device's local timezone."
          >
            {lastSaveInfo}
          </span>
        )}
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        {isSaving ? (
          <>
            Writing scan progress and new available domains to storage (please
            keep this tab open until this finishes).
          </>
        ) : isScanning ? (
          <>
            Next save in about{" "}
            <span className="text-foreground tabular-nums">
              {batchesUntilNextSave}
            </span>{" "}
            batches (
            <span className="tabular-nums">
              {domainsUntilNextSave.toLocaleString()}
            </span>{" "}
            name checks, {nextSaveEta} at the current pace). While scanning,
            saves run every{" "}
            <span className="tabular-nums">{SAVE_EVERY_N_BATCHES}</span> batches
            (~
            <span className="tabular-nums">
              {(SAVE_EVERY_N_BATCHES * DOMAINS_PER_SCAN_BATCH).toLocaleString()}
            </span>{" "}
            names), and again when the scan completes.
          </>
        ) : (
          <>
            While scanning, results save about every{" "}
            <span className="tabular-nums">{SAVE_EVERY_N_BATCHES}</span> batches
            (~
            <span className="tabular-nums">
              {(SAVE_EVERY_N_BATCHES * DOMAINS_PER_SCAN_BATCH).toLocaleString()}
            </span>{" "}
            names checked, on the order of a minute at the usual rate), plus a
            final save when the run finishes.
          </>
        )}
      </p>

      <div className="space-y-1">
        <Progress value={progress} className="h-2" />
        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
          <span>
            {state
              ? `${state.offset.toLocaleString()} / ${state.total.toLocaleString()} checked`
              : "Loading..."}
          </span>
          <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            {state && (
              <>
                {scannedPct !== null && (
                  <span
                    className="tabular-nums"
                    title="Share of the full list checked so far"
                  >
                    {scannedPct.toFixed(1)}% scanned
                  </span>
                )}
                {availableOfCheckedPct !== null && (
                  <span
                    className="tabular-nums text-green-600"
                    title="Share of checked names that are available"
                  >
                    {availableOfCheckedPct.toFixed(1)}% avail.
                  </span>
                )}
                <span className="text-green-600">
                  {state.availableCount.toLocaleString()} available
                </span>
                {notAvailableCount > 0 && (
                  <span
                    className="text-muted-foreground"
                    title="Registered, taken, or not returned as available by the API"
                  >
                    {notAvailableCount.toLocaleString()} not available
                  </span>
                )}
                {etaMinutes !== null && (
                  <span>~{Math.ceil(etaMinutes)} min remaining</span>
                )}
              </>
            )}
          </span>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
