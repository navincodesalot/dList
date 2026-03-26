import { NextResponse } from "next/server";
import { getResults } from "@/lib/blob";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tld = searchParams.get("tld");
    const length = searchParams.get("length");
    const premium = searchParams.get("premium");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") ?? "domain";
    const sortDir = searchParams.get("sortDir") ?? "asc";

    let results = await getResults();

    if (tld) {
      results = results.filter((d) => d.tld === tld);
    }
    if (length) {
      results = results.filter((d) => d.length === parseInt(length, 10));
    }
    if (premium === "yes") {
      results = results.filter((d) => d.isPremium);
    } else if (premium === "no") {
      results = results.filter((d) => !d.isPremium);
    }
    if (search) {
      const q = search.toLowerCase();
      results = results.filter((d) => d.domain.toLowerCase().includes(q));
    }

    results.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "domain":
          cmp = a.domain.localeCompare(b.domain);
          break;
        case "tld":
          cmp = a.tld.localeCompare(b.tld);
          break;
        case "length":
          cmp = a.length - b.length;
          break;
        case "price":
          cmp = (a.registerPrice ?? 0) - (b.registerPrice ?? 0);
          break;
        default:
          cmp = a.domain.localeCompare(b.domain);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return NextResponse.json({
      domains: results,
      total: results.length,
    });
  } catch (error) {
    console.error("Get results error:", error);
    return NextResponse.json(
      { error: "Failed to get results" },
      { status: 500 },
    );
  }
}
