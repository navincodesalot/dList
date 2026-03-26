import { NextResponse } from "next/server";
import { getConfig, setConfig } from "@/lib/blob";
import type { AppConfig } from "@/lib/types";

export async function GET() {
  try {
    const config = await getConfig();
    const hasEnvKeys = !!(
      process.env.SPACESHIP_API_KEY && process.env.SPACESHIP_API_SECRET
    );

    return NextResponse.json({
      hasEnvKeys,
      hasBlobKeys: !!(config?.apiKey && config?.apiSecret),
      configured: hasEnvKeys || !!(config?.apiKey && config?.apiSecret),
    });
  } catch (error) {
    console.error("Get config error:", error);
    return NextResponse.json(
      { error: "Failed to get config" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AppConfig>;

    if (!body.apiKey || !body.apiSecret) {
      return NextResponse.json(
        { error: "Both apiKey and apiSecret are required" },
        { status: 400 },
      );
    }

    await setConfig({ apiKey: body.apiKey, apiSecret: body.apiSecret });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set config error:", error);
    return NextResponse.json(
      { error: "Failed to save config" },
      { status: 500 },
    );
  }
}
