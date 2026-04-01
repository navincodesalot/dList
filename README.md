# dList

A bulk short-domain availability checker. Generates every 1–3 character alphanumeric name across `.com`, `.ai`, and `.space` (**143,964 domains**), checks them against the [Spaceship API](https://spaceship.dev), and stores available hits with pricing in [Vercel Blob](https://vercel.com/docs/storage/vercel-blob). Includes an AI chat assistant that can query and analyze your results in real time.

## Features

- **Automated scanning** — batches of 20, Spaceship rate limit respected. One-click **Start Scan**; tab-close resumes from the last saved offset. Available hits buffer in-browser and flush every **50 batches** (~1k names) via `/api/scan/save`, which keeps Blob **`put()`** usage low. The scan panel estimates the next save, shows **unsaved available** counts, last save time (local TZ), and warns on `beforeunload` if hits are still unsaved.
- **Live progress** — progress bar, % scanned, % available, counts for available / not available, and an ETA.
- **Filterable & sortable table** — search by name, filter by TLD / character length / premium status, sort by domain, TLD, length, or price.
- **Server-side pagination** — 10 / 25 / 50 / 100 rows per page with numbered page controls. Results stay in Vercel Blob and are only fetched for the current page.
- **AI chat panel** — powered by Google Gemini via the Vercel AI SDK. Has tool access to scan stats, domain search, and filtered counts so it can answer questions like *"show me 2-letter .ai domains"* or *"which premium domains are cheapest?"*. Responses render as streamed markdown via [Streamdown](https://streamdown.ai).
- **Premium detection** — flags premium domains and shows the register price + currency from Spaceship's pricing data.
- **Server-side timing logs** — each batch logs the `spaceship` API round-trip duration (color-coded green/yellow/red in bash) for easy performance monitoring.
- **Dark mode** — toggle between light and dark themes.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| UI | [React 19](https://react.dev), [Tailwind CSS 4](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com) (Base UI) |
| AI | [Vercel AI SDK v6](https://sdk.vercel.ai), [Google Gemini](https://ai.google.dev), [Streamdown](https://streamdown.ai) |
| Storage | [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) |
| Domain API | [Spaceship](https://docs.spaceship.dev) |
| Language | TypeScript 5.8 |
| Package Manager | pnpm |

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/<your-username>/dList.git
cd dList
pnpm install
```

### 2. Environment variables

Copy the example and fill in your keys:

```bash
cp .env.example .env
```

| Variable | Purpose |
|----------|---------|
| `SPACESHIP_API_KEY` | Spaceship API key ([get one here](https://spaceship.com)) |
| `SPACESHIP_API_SECRET` | Spaceship API secret |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini key for the AI chat |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (auto-set when linked to a Vercel project) |

Spaceship credentials can also be configured at runtime via the Settings modal in the app.

### 3. Run locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Start Scan** to begin checking domains.

### 4. Deploy

Deploy to [Vercel](https://vercel.com) — Blob storage and environment variables are configured automatically when you link the project.

## How It Works

```
domain-generator.ts          spaceship.ts            browser memory          blob.ts
┌─────────────────┐    ┌──────────────────────┐    ┌───────────────┐    ┌──────────────┐
│ Enumerates every │───>│ POST /domains/avail. │───>│ Accumulate    │─┬─>│ Bulk write   │
│ 1-3 char name ×  │    │ (20 per request,     │    │ available hits │ │  │ results.json │
│ .com .ai .space  │    │  Spaceship API)       │    │ client-side   │ │  │ + scan-state │
└─────────────────┘    └──────────────────────┘    └───────────────┘ │  └──────────────┘
       36¹ + 36² + 36³ = 47,988 names × 3 TLDs = 143,964 domains   │
                                                       flush every ~50 batches
```

1. **Generate** — `domain-generator.ts` enumerates all base-36 names (a–z, 0–9) from length 1 to 3, paired with each TLD.
2. **Check** — `/api/scan/batch` receives an offset from the client, sends 20 domains to Spaceship, and returns results with zero blob I/O. The client-side loop fires one batch per ~1.1 s.
3. **Accumulate** — the browser holds available domain hits in memory. Every ~50 batches (~1,000 domains checked) or on scan completion, the client flushes everything to Vercel Blob via `/api/scan/save`. That slashes **Advanced operations** compared to writing after every batch (see below).
4. **Display** — the paginated table fetches slices from `/api/results`. The AI chat reads the same blob data through server-side tools.

## Vercel Blob quotas

On Vercel Blob, **Advanced operations** are the ones that count toward that meter: **`put()`**, **`copy()`**, and **`list()`** — not plain reads via **`get()`**. This project only uses `put`, `get`, and `delete` (`/api/scan/reset` — not exposed in the UI); it does **not** call `copy` or `list`. The expensive part of a long scan used to be **`put()`**: every batch appended results and rewrote scan state, so you paid two advanced ops per batch, tens of thousands over a full run. Client-side accumulation + periodic `/api/scan/save` keeps **`put()`** rare during the scan (roughly two writes per flush: `results.json` and `scan-state.json`), which is what keeps you inside typical free-tier limits.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm check` | Lint + typecheck |
| `pnpm format:write` | Format with Prettier |

## Rate Limits

Spaceship allows **30 requests per user per 30 seconds** on the bulk availability endpoint, each carrying up to **20 domains**. That works out to a ceiling of **~600 domains / 30 s** (~20 / s). A full scan of 143,964 domains takes roughly **2 hours**.

## License

MIT
