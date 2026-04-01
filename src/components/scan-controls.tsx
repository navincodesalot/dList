"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DEFAULT_SCAN_STATE, type ScanState } from "@/lib/types";

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

interface ScanControlsProps {
  /** Called after scan + results are cleared so the table can refetch once. */
  onScanReset?: () => void;
}

export function ScanControls({ onScanReset }: ScanControlsProps) {
  const [state, setState] = useState<ScanState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanRef = useRef(false);
  const scanLoopActiveRef = useRef(false);
  const retryCountRef = useRef(0);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/scan/state");
      const raw = await res.json();
      const data = mergeScanState(raw);
      setState(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  const runScanLoop = useCallback(async () => {
    if (scanLoopActiveRef.current) return;
    scanLoopActiveRef.current = true;
    scanRef.current = true;
    setIsScanning(true);
    setError(null);
    retryCountRef.current = 0;

    try {
      while (scanRef.current) {
        try {
          const res = await fetch("/api/scan/batch", { method: "POST" });

          if (res.status === 429) {
            if (retryCountRef.current >= MAX_RETRIES) {
              setError(
                "Rate limited by Spaceship API — max retries reached. Try starting again later.",
              );
              scanRef.current = false;
              void fetchState();
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
            void fetchState();
            break;
          }

          retryCountRef.current = 0;
          setError(null);

          const data = (await res.json()) as {
            done: boolean;
            state: ScanState;
          };
          setState(mergeScanState(data.state));

          if (data.done) {
            scanRef.current = false;
            break;
          }

          await new Promise((r) => setTimeout(r, 1100));
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
    } finally {
      scanLoopActiveRef.current = false;
      setIsScanning(false);
    }
  }, [fetchState]);

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
      setState(mergeScanState(raw));
      void runScanLoop();
    } catch {
      setError("Failed to start scan");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    scanRef.current = false;
    setIsLoading(true);
    try {
      const res = await fetch("/api/scan/reset", { method: "POST" });
      const raw = await res.json();
      setState(mergeScanState(raw));
      onScanReset?.();
    } catch {
      setError("Failed to reset scan");
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
        <Button
          onClick={handleReset}
          disabled={isLoading || isScanning}
          variant="outline"
          size="sm"
        >
          Reset
        </Button>
      </div>

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
                  <span className="tabular-nums" title="Share of the full list checked so far">
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
                    title="Registered, taken, or not returned as available by the API (includes explicit unavailable and other non-available results)"
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
