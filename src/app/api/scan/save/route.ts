import { NextResponse } from "next/server";
import { appendResults, setScanState } from "@/lib/blob";
import type { ScanState, AvailableDomain } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      domains: AvailableDomain[];
      state: ScanState;
    };

    const t0 = performance.now();

    if (body.domains.length > 0) {
      await appendResults(body.domains);
    }

    await setScanState(body.state);

    const ms = Math.round(performance.now() - t0);
    console.info(
      `[scan/save] ${ms}ms saved=${body.domains.length} domains offset=${body.state.offset}`,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Scan save error:", error);
    return NextResponse.json(
      { error: "Failed to save scan data" },
      { status: 500 },
    );
  }
}
