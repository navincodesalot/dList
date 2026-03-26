"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ScanState } from "@/lib/types";

interface ScanControlsProps {
  onResultsUpdate: () => void;
}

export function ScanControls({ onResultsUpdate }: ScanControlsProps) {
  const [state, setState] = useState<ScanState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanRef = useRef(false);
  const retryCountRef = useRef(0);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/scan/state");
      const data = (await res.json()) as ScanState;
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
    scanRef.current = true;
    setError(null);

    while (scanRef.current) {
      try {
        const res = await fetch("/api/scan/batch", { method: "POST" });

        if (res.status === 429) {
          retryCountRef.current++;
          const backoff = Math.min(retryCountRef.current * 2000, 30000);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        retryCountRef.current = 0;

        if (!res.ok) {
          const data = (await res.json()) as { error: string };
          setError(data.error);
          scanRef.current = false;
          break;
        }

        const data = (await res.json()) as {
          done: boolean;
          state: ScanState;
          batchAvailable?: number;
        };
        setState(data.state);

        if (data.batchAvailable && data.batchAvailable > 0) {
          onResultsUpdate();
        }

        if (data.done) {
          scanRef.current = false;
          break;
        }

        await new Promise((r) => setTimeout(r, 1100));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        scanRef.current = false;
        break;
      }
    }
  }, [onResultsUpdate]);

  const handleStart = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scan/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = (await res.json()) as ScanState;
      setState(data);
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
      const data = (await res.json()) as ScanState;
      setState(data);
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
      const data = (await res.json()) as ScanState;
      setState(data);
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
