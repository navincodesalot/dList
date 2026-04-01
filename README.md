# dList

A bulk short-domain availability checker. Generates every 1–3 character alphanumeric name across `.com`, `.ai`, and `.space` (**143,964 domains**), checks them against the [Spaceship API](https://spaceship.dev), and stores available hits with pricing in [Vercel Blob](https://vercel.com/docs/storage/vercel-blob). Includes an AI chat assistant that can query and analyze your results in real time.

## Features

- **Automated scanning** — walks through all 144k generated domains in batches of 20, respecting Spaceship's rate limit (30 req / 30 s). Start with one click; close the tab and resume from where you left off.
- **Live progress** — progress bar, % scanned, % available, counts for available / not available, and an ETA.
- **Filterable & sortable table** — search by name, filter by TLD / character length / premium status, sort by domain, TLD, length, or price.
- **Server-side pagination** — 10 / 25 / 50 / 100 rows per page with numbered page controls. Results stay in Vercel Blob and are only fetched for the current page.
- **AI chat panel** — powered by Google Gemini via the Vercel AI SDK. Has tool access to scan stats, domain search, and filtered counts so it can answer questions like *"show me 2-letter .ai domains"* or *"which premium domains are cheapest?"*. Responses render as streamed markdown via [Streamdown](https://streamdown.ai).
- **Premium detection** — flags premium domains and shows the register price + currency from Spaceship's pricing data.
- **Server-side timing logs** — each batch logs `total`, `spaceship`, and `persist` durations (color-coded in bash) for easy performance monitoring.
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
domain-generator.ts          spaceship.ts              blob.ts
┌─────────────────┐    ┌──────────────────────┐    ┌──────────────┐
│ Enumerates every │───>│ POST /domains/avail. │───>│ Append hits  │
│ 1-3 char name ×  │    │ (20 per request,     │    │ to Blob      │
│ .com .ai .space  │    │  Spaceship API)       │    │ results.json │
└─────────────────┘    └──────────────────────┘    └──────────────┘
       36¹ + 36² + 36³ = 47,988 names × 3 TLDs = 143,964 domains
```

1. **Generate** — `domain-generator.ts` enumerates all base-36 names (a–z, 0–9) from length 1 to 3, paired with each TLD.
2. **Check** — `/api/scan/batch` sends 20 domains per POST to Spaceship's availability endpoint. The client-side loop fires one batch per ~1.1 s.
3. **Store** — available domains (with premium pricing) are appended to `results.json` in Vercel Blob. Scan progress lives in `scan-state.json`.
4. **Display** — the paginated table fetches slices from `/api/results`. The AI chat reads the same blob data through server-side tools.

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
