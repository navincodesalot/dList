"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

interface ScanControlsProps {
  onResultsUpdate: (newDomains?: AvailableDomain[]) => void;
}

export function ScanControls({ onResultsUpdate }: ScanControlsProps) {
  const [state, setState] = useState<ScanState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanRef = useRef(false);
  /** Prevents overlapping scan loops (double Start/Resume → concurrent batches and flaky "not running" errors). */
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
    setError(null);
    retryCountRef.current = 0;

    try {
      while (scanRef.current) {
        try {
          const res = await fetch("/api/scan/batch", { method: "POST" });

          if (res.status === 429) {
            if (retryCountRef.current >= MAX_RETRIES) {
              setError("Rate limited by Spaceship API — max retries reached. Pause and try again later.");
              scanRef.current = false;
              void fetchState();
              break;
            }
            retryCountRef.current++;
            const backoff = Math.min(retryCountRef.current * 2000, 30000);
            setError(`Rate limited — retrying in ${Math.ceil(backoff / 1000)}s... (${retryCountRef.current}/${MAX_RETRIES})`);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }

          if (!res.ok) {
            const data = (await res.json()) as {
              error: string;
              retryable?: boolean;
            };

            if (data.retryable !== false && retryCountRef.current < MAX_RETRIES) {
              retryCountRef.current++;
              const backoff = Math.min(retryCountRef.current * 2000, 15000);
              setError(`${data.error} — retrying (${retryCountRef.current}/${MAX_RETRIES})...`);
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
            batchAvailable?: number;
            newDomains?: AvailableDomain[];
          };
          setState(mergeScanState(data.state));

          if (data.newDomains && data.newDomains.length > 0) {
            onResultsUpdate(data.newDomains);
          }

          if (data.done) {
            scanRef.current = false;
            break;
          }

          await new Promise((r) => setTimeout(r, 1100));
        } catch (err) {
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++;
            const backoff = Math.min(retryCountRef.current * 2000, 15000);
            setError(`Network error — retrying (${retryCountRef.current}/${MAX_RETRIES})...`);
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
    }
  }, [onResultsUpdate, fetchState]);

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
    }
    setIsLoading(false);
  };

  const handlePause = async () => {
    scanRef.current = false;
    setIsLoading(true);
    try {
      const res = await fetch("/api/scan/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
      const raw = await res.json();
      if (!res.ok) {
        const err = raw as { error?: string };
        setError(err.error ?? "Failed to pause scan");
        return;
      }
      setState(mergeScanState(raw));
    } catch {
      setError("Failed to pause scan");
    }
    setIsLoading(false);
  };

  const handleReset = async () => {
    scanRef.current = false;
    setIsLoading(true);
    try {
      const res = await fetch("/api/scan/reset", { method: "POST" });
      const raw = await res.json();
      setState(mergeScanState(raw));
      onResultsUpdate();
    } catch {
      setError("Failed to reset scan");
    }
    setIsLoading(false);
  };

  const progress =
    state && state.total > 0 ? (state.offset / state.total) * 100 : 0;

  const etaMinutes =
    state?.status === "running" && state.offset > 0
      ? Math.round(((state.total - state.offset) / 20) * 1.1) / 60
      : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {state?.status === "running" ? (
          <Button
            onClick={handlePause}
            disabled={isLoading}
            variant="secondary"
            size="sm"
          >
            Pause
          </Button>
        ) : (
          <Button
            onClick={handleStart}
            disabled={isLoading || state?.status === "completed"}
            size="sm"
          >
            {state?.status === "paused"
              ? "Resume"
              : state?.status === "completed"
                ? "Completed"
                : "Start Scan"}
          </Button>
        )}
        <Button
          onClick={handleReset}
          disabled={isLoading || state?.status === "running"}
          variant="outline"
          size="sm"
        >
          Reset
        </Button>
      </div>

      <div className="space-y-1">
        <Progress value={progress} className="h-2" />
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>
            {state
              ? `${state.offset.toLocaleString()} / ${state.total.toLocaleString()} checked`
              : "Loading..."}
          </span>
          <span className="flex gap-3">
            {state && (
              <>
                <span className="text-green-600">
                  {state.availableCount} available
                </span>
                {state.errorCount > 0 && (
                  <span className="text-red-500">
                    {state.errorCount} errors
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

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
