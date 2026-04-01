import { NextResponse } from "next/server";
import { getScanState, setScanState } from "@/lib/blob";
import { getTotalDomains } from "@/lib/domain-generator";
import type { ScanState } from "@/lib/types";

export async function GET() {
  try {
    const state = await getScanState();
    state.total = getTotalDomains();
    return NextResponse.json(state);
  } catch (error) {
    console.error("Get scan state error:", error);
    return NextResponse.json(
      { error: "Failed to get scan state" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action: string };
    const state = await getScanState();
    const total = getTotalDomains();

    if (body.action === "start") {
      if (state.status === "running") {
        return NextResponse.json(state);
      }

      const newState: ScanState = {
        ...state,
        status: "running",
        total,
        startedAt: state.startedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setScanState(newState);
      return NextResponse.json(newState);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Update scan state error:", error);
    return NextResponse.json(
      { error: "Failed to update scan state" },
      { status: 500 },
    );
  }
}
