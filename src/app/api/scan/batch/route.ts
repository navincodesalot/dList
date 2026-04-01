import { NextResponse } from "next/server";
import { getDomainBatch, getTotalDomains } from "@/lib/domain-generator";
import { checkDomainsAvailability } from "@/lib/spaceship";

const BATCH_SIZE = 20;

function bashMs(ms: number, good: number, warn: number): string {
  if (process.env.NO_COLOR) return "";
  if (ms < good) return "\x1b[32m";
  if (ms < warn) return "\x1b[33m";
  return "\x1b[31m";
}

const RST = process.env.NO_COLOR ? "" : "\x1b[0m";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { offset?: number };
    const offset = typeof body.offset === "number" ? body.offset : -1;
    const total = getTotalDomains();

    if (offset < 0 || offset >= total) {
      return NextResponse.json({ done: true, total });
    }

    const batch = getDomainBatch(offset, BATCH_SIZE);
    const domainNames = batch.map((d) => d.fullDomain);

    const t0 = performance.now();
    const { available, unavailableCount, errorCount } =
      await checkDomainsAvailability(domainNames);
    const spaceshipMs = Math.round(performance.now() - t0);

    console.info(
      `[scan/batch] spaceship=${bashMs(spaceshipMs, 180, 450)}${spaceshipMs}ms${RST} batchSize=${batch.length} availableInBatch=${available.length}`,
    );

    return NextResponse.json({
      available,
      unavailableCount,
      errorCount,
      batchSize: batch.length,
      total,
      done: offset + batch.length >= total,
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
