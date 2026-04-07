"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Check, Copy, ExternalLink } from "lucide-react";
import type { AvailableDomain } from "@/lib/types";

interface ResultsResponse {
  domains: AvailableDomain[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DomainTableHandle {
  refresh: () => void;
}

/** Clickable domain name that copies to clipboard with a tooltip + toast. */
function CopyDomainCell({ domain }: { domain: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(domain);
    setCopied(true);
    toast.success(`Copied ${domain}`, { duration: 2000 });
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Tooltip>
      <TooltipTrigger
        onClick={() => void handleCopy()}
        className="group flex items-center gap-1.5 font-mono font-medium transition-colors hover:text-primary"
      >
        <span>{domain}</span>
        <span className="text-muted-foreground opacity-0 transition-all duration-150 group-hover:opacity-100">
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">
        {copied ? "Copied!" : "Click to copy"}
      </TooltipContent>
    </Tooltip>
  );
}

/** Price cell — shows price if available, otherwise links to Spaceship search. */
function PriceCell({
  domain,
  registerPrice,
  currency,
}: {
  domain: string;
  registerPrice: number | null;
  currency: string | null;
}) {
  if (registerPrice !== null) {
    return (
      <span>
        ${registerPrice.toFixed(2)} {(currency ?? "").toUpperCase()}
      </span>
    );
  }

  const searchUrl = `https://www.spaceship.com/domain-search/?query=${encodeURIComponent(domain)}&tab=domains`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors underline-offset-4 hover:underline"
          >
            Check price
            <ExternalLink className="h-3 w-3" />
          </a>
        }
      />
      <TooltipContent side="right">Search on Spaceship</TooltipContent>
    </Tooltip>
  );
}

/** Page numbers + ellipsis for large page counts (shadcn-style). */
function getPaginationRange(
  current: number,
  total: number,
): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const delta = 2;
  const range: (number | "ellipsis")[] = [];
  range.push(1);
  if (current > delta + 2) range.push("ellipsis");
  const start = Math.max(2, current - delta);
  const end = Math.min(total - 1, current + delta);
  for (let i = start; i <= end; i++) range.push(i);
  if (current < total - delta - 1) range.push("ellipsis");
  range.push(total);
  return range;
}

export const DomainTable = forwardRef<DomainTableHandle>(
  function DomainTable(_props, ref) {
    const [domains, setDomains] = useState<AvailableDomain[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);

    const [tldFilter, setTldFilter] = useState("all");
    const [lengthFilter, setLengthFilter] = useState("all");
    const [premiumFilter, setPremiumFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [sortBy, setSortBy] = useState("domain");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setDebouncedSearch(search), 250);
      return () => clearTimeout(debounceRef.current);
    }, [search]);

    useLayoutEffect(() => {
      setPage(1);
    }, [
      tldFilter,
      lengthFilter,
      premiumFilter,
      debouncedSearch,
      sortBy,
      sortDir,
    ]);

    const fetchResults = useCallback(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (tldFilter !== "all") params.set("tld", tldFilter);
        if (lengthFilter !== "all") params.set("length", lengthFilter);
        if (premiumFilter !== "all") params.set("premium", premiumFilter);
        if (debouncedSearch) params.set("search", debouncedSearch);
        params.set("sortBy", sortBy);
        params.set("sortDir", sortDir);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const res = await fetch(`/api/results?${params.toString()}`);
        const data = (await res.json()) as ResultsResponse;
        setDomains(data.domains);
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
      } catch {
        // ignore
      }
      setLoading(false);
    }, [
      tldFilter,
      lengthFilter,
      premiumFilter,
      debouncedSearch,
      sortBy,
      sortDir,
      page,
      pageSize,
    ]);

    useEffect(() => {
      void fetchResults();
    }, [fetchResults]);

    useImperativeHandle(
      ref,
      () => ({
        refresh: () => void fetchResults(),
      }),
      [fetchResults],
    );

    const toggleSort = (col: string) => {
      if (sortBy === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(col);
        setSortDir("asc");
      }
    };

    const sortIcon = (col: string) => {
      if (sortBy !== col) return " ↕";
      return sortDir === "asc" ? " ↑" : " ↓";
    };

    const handleSelectChange =
      (setter: (v: string) => void) => (value: string | null) => {
        if (value !== null) setter(value);
      };

    const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const rangeEnd = Math.min(page * pageSize, total);
    const pageItems = getPaginationRange(page, totalPages);

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search domains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Select
            value={tldFilter}
            onValueChange={handleSelectChange(setTldFilter)}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="TLD" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All TLDs</SelectItem>
              <SelectItem value="com">.com</SelectItem>
              <SelectItem value="ai">.ai</SelectItem>
              <SelectItem value="space">.space</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={lengthFilter}
            onValueChange={handleSelectChange(setLengthFilter)}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Length" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="1">1 char</SelectItem>
              <SelectItem value="2">2 char</SelectItem>
              <SelectItem value="3">3 char</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={premiumFilter}
            onValueChange={handleSelectChange(setPremiumFilter)}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Premium" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">Premium</SelectItem>
              <SelectItem value="no">Standard</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Rows" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="25">25 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
              <SelectItem value="100">100 / page</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => void fetchResults()}>
            Refresh
          </Button>
          <span className="text-muted-foreground ml-auto text-sm">
            {total.toLocaleString()} domain{total !== 1 && "s"}
          </span>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("domain")}
                >
                  Domain{sortIcon("domain")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("tld")}
                >
                  TLD{sortIcon("tld")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("length")}
                >
                  Length{sortIcon("length")}
                </TableHead>
                <TableHead>Premium</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("price")}
                >
                  Price{sortIcon("price")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground text-center"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : domains.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground text-center"
                  >
                    No available domains found. Start a scan to discover
                    domains.
                  </TableCell>
                </TableRow>
              ) : (
                domains.map((d) => (
                  <TableRow key={d.domain}>
                    <TableCell>
                      <CopyDomainCell domain={d.domain} />
                    </TableCell>
                    <TableCell>.{d.tld}</TableCell>
                    <TableCell>{d.length}</TableCell>
                    <TableCell>
                      {d.isPremium ? (
                        <Badge variant="secondary">Premium</Badge>
                      ) : (
                        <Badge variant="outline">Standard</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <PriceCell
                        domain={d.domain}
                        registerPrice={d.registerPrice}
                        currency={d.currency}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {total > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm">
              Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}{" "}
              of {total.toLocaleString()}
            </p>
            <Pagination className="mx-0 w-full justify-end sm:w-auto">
              <PaginationContent className="flex-wrap justify-end">
                <PaginationItem>
                  <PaginationPrevious
                    disabled={loading || page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  />
                </PaginationItem>
                {pageItems.map((item, i) =>
                  item === "ellipsis" ? (
                    <PaginationItem key={`e-${i}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        size="sm"
                        className="min-w-9"
                        isActive={page === item}
                        onClick={() => setPage(item)}
                        aria-label={`Page ${item}`}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    disabled={loading || page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    );
  },
);
