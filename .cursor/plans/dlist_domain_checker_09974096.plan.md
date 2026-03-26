---
name: dList Domain Checker
overview: Build a full-stack domain availability checker for all 1–3 character alphanumeric combinations on .com and .ai TLDs, using the Spaceship API, with a scannable UI, filterable results table, and an AI chat powered by Gemini Flash. Deployed on Vercel using Vercel Blob for persistence.
todos:
  - id: install-deps
    content: Install @vercel/blob and ai packages; init shadcn and add required components (table, button, input, badge, progress, dialog, select, card, scroll-area)
    status: pending
  - id: domain-generator
    content: Create src/lib/domain-generator.ts with getDomainAtOffset(offset) and getTotalDomains() — generates domain names algorithmically so nothing needs seeding
    status: pending
  - id: blob-helpers
    content: Create src/lib/blob.ts with typed helpers for reading/writing scan-state.json, results.json, and config.json in Vercel Blob
    status: pending
  - id: spaceship-client
    content: Create src/lib/spaceship.ts with batch availability check function (handles 20-domain batches, reads key from env or config blob)
    status: pending
  - id: scan-api
    content: Create /api/scan/batch (POST - checks next 20 domains, saves to blob), /api/scan/state (GET/POST - scan state), /api/scan/reset (POST - resets scan)
    status: pending
  - id: results-api
    content: Create /api/results route that reads results.json from Blob and returns available domains with filtering params
    status: pending
  - id: chat-api
    content: Create /api/chat route using Gemini Flash with tool calling (getDomainStats, searchAvailableDomains, getFilteredCount) that reads from results blob
    status: pending
  - id: config-api
    content: Create /api/config route for reading/writing API keys to config.json in Blob
    status: pending
  - id: ui-components
    content: Build domain-table.tsx, scan-controls.tsx, settings-modal.tsx, and chat-panel.tsx components
    status: pending
  - id: main-page
    content: Wire everything together in src/app/page.tsx with split-view layout; update layout.tsx metadata
    status: pending
isProject: false
---

# dList Domain Availability Checker

## Key Decisions

- **Vercel Blob (only external service):** Replaces SQLite. Stores 3 small JSON files: scan state, results, and config. No database needed.
- **Algorithmic domain generation (no seeding):** Domain names are derived mathematically from an integer offset (`getDomainAtOffset(n)`). Nothing stored upfront — scan state just tracks the current offset.
- **Frontend-driven scan loop (solves Vercel timeout):** The browser calls `/api/scan/batch` every ~1 second. Each serverless function call is short (checks 20 domains, saves to Blob, returns). No single function runs for more than ~2 seconds, so Vercel's timeout is never an issue even for the 80-minute full scan.
- **Available-only results storage:** Only available domains are written to `results.json`. Unavailable results are discarded after counting. This keeps the Blob payload small.
- **AI chat uses tool calling:** Gemini Flash (**_gemini-3-flash-preview)_** reads `results.json` from Blob via tools (`getDomainStats`, `searchAvailableDomains`, `getFilteredCount`).
- **API key storage:** Env vars (`SPACESHIP_API_KEY` / `SPACESHIP_API_SECRET`) are primary. Settings modal writes to `config.json` in Blob as fallback — no file editing needed.

## Domain Count

- Characters: `a-z` (26) + `0-9` (10) = 36 chars, no hyphens/special chars
- TLDs: `.com`, `.ai`, `.space`
- 1-char: 36 · 3 TLDs = 108
- 2-char: 1,296 · 3 TLDs = 3,888
- 3-char: 46,656 · 3 TLDs = 139,968
- **Total: 143,964 domains to check**
- At 20 domains/batch, ~1 req/sec → ~7,200 frontend loop iterations → ~120 min full scan

## Vercel Blob Files

- `scan-state.json` — `{ status, offset, total, availableCount, errorCount, startedAt, updatedAt }`
- `results.json` — array of `{ domain, tld, length, isPremium, registerPrice, currency }` (available only)
- `config.json` — `{ apiKey, apiSecret }` (only written if user sets keys via UI)

## Architecture

```mermaid
flowchart TD
  Browser --> ScanLoop[Client Scan Loop]
  Browser --> TableUI[Domain Table]
  Browser --> ChatUI[AI Chat Panel]
  Browser --> SettingsModal[Settings Modal]

  ScanLoop -->|"POST every ~1s"| BatchAPI[/api/scan/batch]
  TableUI -->|GET| ResultsAPI[/api/results]
  ChatUI -->|POST stream| ChatAPI[/api/chat]
  SettingsModal -->|GET/POST| ConfigAPI[/api/config]

  BatchAPI --> SpaceshipAPI[Spaceship API]
  BatchAPI --> BlobStore[(Vercel Blob)]
  ResultsAPI --> BlobStore
  ChatAPI --> BlobStore
  ChatAPI --> Gemini[Gemini Flash]
  ConfigAPI --> BlobStore
```

## File Structure

```
src/
  app/
    page.tsx                      ← main page (table + chat split view)
    api/
      scan/
        batch/route.ts            ← POST: check next 20 domains, update blob
        state/route.ts            ← GET/POST: scan-state.json
        reset/route.ts            ← POST: wipe state + results, restart
      results/route.ts            ← GET: available domains from results.json
      chat/route.ts               ← POST: Gemini streaming chat with tools
      config/route.ts             ← GET/POST: config.json (API keys)
  components/
    domain-table.tsx              ← shadcn Table with client-side filter controls
    scan-controls.tsx             ← start/pause/reset + progress bar + ETA
    chat-panel.tsx                ← streaming chat UI
    settings-modal.tsx            ← API key + secret input modal
  lib/
    blob.ts                       ← typed Blob read/write helpers
    spaceship.ts                  ← Spaceship API client (batch check)
    domain-generator.ts           ← getDomainAtOffset(n), getTotalDomains()
```

## Dependencies to Add

- `@vercel/blob`
- `ai` (the core AI SDK, complements `@ai-sdk/google` already installed)
- shadcn CLI + components: `table`, `button`, `input`, `badge`, `progress`, `dialog`, `select`, `card`, `scroll-area`, `separator`

## Scan Loop (Client-Side)

```
user clicks Start
  → fetch /api/scan/state (get current offset)
  → loop:
      POST /api/scan/batch  ← server checks domains[offset..offset+20] via Spaceship
                            ← server appends available ones to results.json
                            ← server updates scan-state.json offset
                            ← returns { newOffset, batchAvailable, done }
      wait 1 second
      update progress bar
      if done or user pauses → stop loop
```

## `/api/scan/batch` Logic

1. Read `scan-state.json` from Blob (or initialize if missing)
2. Compute next 20 domain names from current offset using `getDomainAtOffset()`
3. POST to Spaceship `/v1/domains/available` with API key from env or `config.json`
4. Filter results for `available` status
5. Append available domains to `results.json` (read → merge → write)
6. Update `scan-state.json` with new offset + counts
7. Return `{ newOffset, batchAvailable, batchChecked, done }`

## UI Layout

- **Top bar:** App title + tagline, Settings button (API keys), Scan controls (Start/Pause/Reset + progress bar + `X/143,964 checked · Y available · ~Z min remaining`)
- **Main area split:** Left ~65% domain table, Right ~35% collapsible AI chat
- **Table columns:** Domain, TLD, Length, Premium (badge), Register Price, (empty = not available shown, only available records)
- **Table filters:** TLD (all/.com/.ai/.space), Length (all/1/2/3), Premium (all/yes/no), Price range, name search
- **Chat:** Gemini Flash with tools that query the in-memory results; answers like "what are all available 2-char .ai domains?"

## Environment Variables

```
SPACESHIP_API_KEY=your_key
SPACESHIP_API_SECRET=your_secret
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token   # auto-added by Vercel when you add Blob storage
```
