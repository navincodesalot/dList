import { google } from "@ai-sdk/google";
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { getResults } from "@/lib/blob";
import { getScanState } from "@/lib/blob";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  const result = streamText({
    model: google("gemini-3-flash-preview"),
    system: `You are a helpful assistant for dList, a domain availability checker. 
You help users explore and analyze domain availability data. 
You have access to tools that let you query the scan results and statistics.
When users ask about available domains, use the tools to look up actual data.
After each tool returns, always write a short natural-language answer for the user (do not stop with only tool calls).
Be concise but informative. Format domain names in backticks when listing them.`,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(12),
    tools: {
      getDomainStats: {
        description:
          "Get statistics about the current scan: total checked, available count, breakdown by TLD and length",
        inputSchema: z.object({}),
        execute: async () => {
          const state = await getScanState();
          const results = await getResults();

          const byTld: Record<string, number> = {};
          const byLength: Record<number, number> = {};
          const premiumCount = results.filter((d) => d.isPremium).length;

          for (const d of results) {
            byTld[d.tld] = (byTld[d.tld] ?? 0) + 1;
            byLength[d.length] = (byLength[d.length] ?? 0) + 1;
          }

          return {
            scanStatus: state.status,
            totalChecked: state.offset,
            totalToCheck: state.total,
            availableCount: results.length,
            unavailableCount: state.unavailableCount,
            premiumCount,
            byTld,
            byLength,
          };
        },
      },
      searchAvailableDomains: {
        description:
          "Search available domains with optional filters. Returns matching domains with pricing info.",
        inputSchema: z.object({
          tld: z
            .string()
            .optional()
            .describe("Filter by TLD (com, ai, or space)"),
          maxLength: z
            .number()
            .optional()
            .describe("Filter by max character length (1, 2, or 3)"),
          minLength: z
            .number()
            .optional()
            .describe("Filter by min character length (1, 2, or 3)"),
          search: z
            .string()
            .optional()
            .describe("Search substring in domain name"),
          premiumOnly: z
            .boolean()
            .optional()
            .describe("Only return premium domains"),
          limit: z
            .number()
            .optional()
            .describe("Max results to return (default 50)"),
        }),
        execute: async ({
          tld,
          maxLength,
          minLength,
          search,
          premiumOnly,
          limit,
        }: {
          tld?: string;
          maxLength?: number;
          minLength?: number;
          search?: string;
          premiumOnly?: boolean;
          limit?: number;
        }) => {
          const cap = limit ?? 50;
          let results = await getResults();

          if (tld) results = results.filter((d) => d.tld === tld);
          if (maxLength) results = results.filter((d) => d.length <= maxLength);
          if (minLength) results = results.filter((d) => d.length >= minLength);
          if (search) {
            const q = search.toLowerCase();
            results = results.filter((d) =>
              d.domain.toLowerCase().includes(q),
            );
          }
          if (premiumOnly) results = results.filter((d) => d.isPremium);

          return {
            total: results.length,
            domains: results.slice(0, cap).map((d) => ({
              domain: d.domain,
              isPremium: d.isPremium,
              price: d.registerPrice
                ? `${d.registerPrice} ${d.currency}`
                : null,
            })),
          };
        },
      },
      getFilteredCount: {
        description:
          "Get the count of available domains matching specific filters without returning all data",
        inputSchema: z.object({
          tld: z.string().optional().describe("Filter by TLD"),
          length: z.number().optional().describe("Exact character length"),
          premiumOnly: z
            .boolean()
            .optional()
            .describe("Only count premium domains"),
        }),
        execute: async ({
          tld,
          length,
          premiumOnly,
        }: {
          tld?: string;
          length?: number;
          premiumOnly?: boolean;
        }) => {
          let results = await getResults();
          if (tld) results = results.filter((d) => d.tld === tld);
          if (length) results = results.filter((d) => d.length === length);
          if (premiumOnly) results = results.filter((d) => d.isPremium);
          return { count: results.length };
        },
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
