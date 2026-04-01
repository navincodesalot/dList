"use client";

import {
  useState,
  useEffect,
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
import type { AvailableDomain } from "@/lib/types";

interface ResultsResponse {
  domains: AvailableDomain[];
  total: number;
}

/** One row per FQDN; if the API or blob has duplicates, keep the latest check. */
function dedupeByDomain(domains: AvailableDomain[]): AvailableDomain[] {
  const map = new Map<string, AvailableDomain>();
  for (const d of domains) {
    const cur = map.get(d.domain);
    if (!cur || d.checkedAt > cur.checkedAt) map.set(d.domain, d);
  }
  return [...map.values()];
}

export interface DomainTableHandle {
  refresh: () => void;
  mergeNewDomains: (newDomains: AvailableDomain[]) => void;
}

export const DomainTable = forwardRef<DomainTableHandle>(
  function DomainTable(_props, ref) {
    const [domains, setDomains] = useState<AvailableDomain[]>([]);
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

        const res = await fetch(`/api/results?${params.toString()}`);
        const data = (await res.json()) as ResultsResponse;
        setDomains(dedupeByDomain(data.domains));
      } catch {
        // ignore
      }
      setLoading(false);
    }, [tldFilter, lengthFilter, premiumFilter, debouncedSearch, sortBy, sortDir]);

    useEffect(() => {
      void fetchResults();
    }, [fetchResults]);

    const mergeNewDomains = useCallback(
      (newDomains: AvailableDomain[]) => {
        setDomains((prev) => {
          const seen = new Set(prev.map((d) => d.domain));
          const filtered: AvailableDomain[] = [];
          for (const d of newDomains) {
            if (seen.has(d.domain)) continue;
            if (tldFilter !== "all" && d.tld !== tldFilter) continue;
            if (
              lengthFilter !== "all" &&
              d.length !== parseInt(lengthFilter, 10)
            )
              continue;
            if (premiumFilter === "yes" && !d.isPremium) continue;
            if (premiumFilter === "no" && d.isPremium) continue;
            if (
              debouncedSearch &&
              !d.domain.toLowerCase().includes(debouncedSearch.toLowerCase())
            )
              continue;
            seen.add(d.domain);
            filtered.push(d);
          }
          if (filtered.length === 0) return prev;
          const merged = dedupeByDomain([...prev, ...filtered]);
          merged.sort((a, b) => {
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
          return merged;
        });
      },
      [tldFilter, lengthFilter, premiumFilter, debouncedSearch, sortBy, sortDir],
    );

    useImperativeHandle(ref, () => ({
      refresh: () => void fetchResults(),
      mergeNewDomains,
    }));

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
          <Button variant="ghost" size="sm" onClick={() => void fetchResults()}>
            Refresh
          </Button>
          <span className="text-muted-foreground ml-auto text-sm">
            {domains.length} domain{domains.length !== 1 && "s"}
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
                    <TableCell className="font-mono font-medium">
                      {d.domain}
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
                      {d.registerPrice
                        ? `$${d.registerPrice.toFixed(2)} ${d.currency ?? ""}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  },
);
