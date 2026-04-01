import { NextResponse } from "next/server";
import { getScanState, setScanState, appendResults } from "@/lib/blob";
import { getDomainBatch, getTotalDomains } from "@/lib/domain-generator";
import { checkDomainsAvailability } from "@/lib/spaceship";

const BATCH_SIZE = 20;

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
        {
          error:
            state.status === "paused"
              ? "Scan is paused"
              : "Scan is not running",
          retryable: false,
        },
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

    const { available, unavailableCount, errorCount } =
      await checkDomainsAvailability(domainNames);

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
