import { NextResponse } from "next/server";
import { getResults } from "@/lib/blob";
import type { AvailableDomain } from "@/lib/types";

function dedupeByDomain(domains: AvailableDomain[]): AvailableDomain[] {
  const map = new Map<string, AvailableDomain>();
  for (const d of domains) {
    const cur = map.get(d.domain);
    if (!cur || d.checkedAt > cur.checkedAt) map.set(d.domain, d);
  }
  return [...map.values()];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tld = searchParams.get("tld");
    const length = searchParams.get("length");
    const premium = searchParams.get("premium");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") ?? "domain";
    const sortDir = searchParams.get("sortDir") ?? "asc";

    const pageRaw = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSizeRaw = parseInt(searchParams.get("pageSize") ?? "25", 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const pageSize = Math.min(
      100,
      Math.max(10, Number.isFinite(pageSizeRaw) ? pageSizeRaw : 25),
    );

    let results = dedupeByDomain(await getResults());

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

    const total = results.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const domains = results.slice(start, start + pageSize);

    return NextResponse.json({
      domains,
      total,
      page: safePage,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error("Get results error:", error);
    return NextResponse.json(
      { error: "Failed to get results" },
      { status: 500 },
    );
  }
}
