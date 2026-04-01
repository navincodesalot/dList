import { NextResponse } from "next/server";
import { getScanState, setScanState, appendResults } from "@/lib/blob";
import { getDomainBatch, getTotalDomains } from "@/lib/domain-generator";
import { checkDomainsAvailability } from "@/lib/spaceship";

const BATCH_SIZE = 20;

/** Bash-friendly ANSI: green / yellow / red by thresholds (ms). Respects NO_COLOR. */
function bashMs(ms: number, good: number, warn: number): string {
  if (process.env.NO_COLOR) return "";
  if (ms < good) return "\x1b[32m";
  if (ms < warn) return "\x1b[33m";
  return "\x1b[31m";
}

const RST = process.env.NO_COLOR ? "" : "\x1b[0m";

export async function POST() {
  try {
    const state = await getScanState();
    const total = getTotalDomains();

    if (state.status === "completed") {
      if (state.total !== total) {
        state.total = total;
        await setScanState(state);
      }
      return NextResponse.json({ done: true, state });
    }

    if (state.status !== "running") {
      return NextResponse.json(
        { error: "Scan is not running", retryable: false },
        { status: 400 },
      );
    }
    if (state.offset >= total) {
      state.status = "completed";
      state.updatedAt = new Date().toISOString();
      await setScanState(state);
      return NextResponse.json({ done: true, state });
    }

    const batch = getDomainBatch(state.offset, BATCH_SIZE);
    const domainNames = batch.map((d) => d.fullDomain);

    /*
     * Timing (ms, server-side; bash logs color total/spaceship/persist green/yellow/red):
     * - total: spaceship + persist (first in log line).
     * - spaceship: POST /domains/available round-trip only.
     * - persist: append results.json (if any) + write scan-state.json.
     * Log tail: batchSize = names sent to Spaceship; availableInBatch = registrable hits this round.
     */
    const batchT0 = performance.now();
    const { available, unavailableCount, errorCount } =
      await checkDomainsAvailability(domainNames);
    const spaceshipMs = Math.round(performance.now() - batchT0);

    const persistT0 = performance.now();
    if (available.length > 0) {
      await appendResults(available);
    }

    state.offset += batch.length;
    state.availableCount += available.length;
    state.unavailableCount += unavailableCount;
    state.errorCount += errorCount;
    state.updatedAt = new Date().toISOString();

    if (state.offset >= total) {
      state.status = "completed";
    }

    await setScanState(state);
    const persistMs = Math.round(performance.now() - persistT0);
    const totalMs = Math.round(performance.now() - batchT0);

    console.info(
      `[scan/batch] total=${bashMs(totalMs, 350, 900)}${totalMs}ms${RST} spaceship=${bashMs(spaceshipMs, 180, 450)}${spaceshipMs}ms${RST} persist=${bashMs(persistMs, 120, 320)}${persistMs}ms${RST} batchSize=${batch.length} availableInBatch=${available.length}`,
    );

    return NextResponse.json({
      done: state.offset >= total,
      batchChecked: batch.length,
      batchAvailable: available.length,
      newDomains: available,
      state,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Rate limited by Spaceship API. Wait a moment and retry." },
        { status: 429 },
      );
    }

    console.error("Scan batch error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        retryable: true,
      },
      { status: 500 },
    );
  }
}
