import { NextResponse } from "next/server";
import { resetAll, setScanState } from "@/lib/blob";
import { getTotalDomains } from "@/lib/domain-generator";
import { DEFAULT_SCAN_STATE } from "@/lib/types";

export async function POST() {
  try {
    await resetAll();
    const state = {
      ...DEFAULT_SCAN_STATE,
      total: getTotalDomains(),
    };
    await setScanState(state);
    return NextResponse.json(state);
  } catch (error) {
    console.error("Reset scan error:", error);
    return NextResponse.json(
      { error: "Failed to reset scan" },
      { status: 500 },
    );
  }
}
