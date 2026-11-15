# Idea Scout

Idea Scout is a Korean-first MVP for checking a service idea against current public web search results. It searches with Tavily, asks an OpenAI-compatible chat completion API to analyze the returned evidence, and presents a source-linked market report.

## Problem

Early-stage builders often need to search several sites manually to learn whether similar services exist, compare their visible features, and identify questions worth validating with users. Idea Scout brings those early research steps into one report while making uncertainty and evidence visible.

## Features

- Responsive landing page and guided idea form with optional context, sample inputs, and PDF/DOCX/TXT/MD upload for LLM-assisted idea extraction.
- Korean and English query planning with an OpenAI-compatible LLM.
- Live Tavily searches, URL de-duplication, source links, and analysis timestamps.
- Structured report sections for idea summary, market signals, competitors, differentiation, MVP, and sources.
- Competitor candidates must match their cited source text and a likely product/service page; glossary/article-only candidates and unverified website URLs are removed before they reach the browser.
- Evidence, AI interpretation, and questions to validate are labeled separately.
- Save, reopen, delete, copy, and Markdown-download reports in browser LocalStorage.
- Live GitHub Repository Search API exploration with language, category, stars, creation/update filters, source metadata, and three AI-generated service ideas per selected repository.
- Community idea submission, public/private visibility, local search/sort/category filters, one vote per anonymous Supabase user, AI-assisted title/problem cleanup, and market-analysis handoff.
- Supabase Auth anonymous sessions and Row Level Security for shared community ideas; browser-only demo mode is clearly labeled when Supabase environment values are absent.
- Light/dark theme, offline status, install prompt, manifest, and a small service worker cache for the app shell and static assets.
- Server-only API keys, input validation, upstream timeouts, error messages, and a per-process request limit.

## Stack

- Next.js App Router and Route Handlers
- TypeScript, React, Tailwind CSS, and small shadcn-style UI primitives
- Zod validation
- Tavily Search API
- OpenAI-compatible Chat Completions API
- GitHub REST API
- Supabase Auth and PostgreSQL (optional, required for cross-device community sharing)
- `pdf-parse`, `mammoth`, and `busboy` for bounded, in-memory document extraction
- Browser LocalStorage and native PWA APIs

## Project Structure

```text
app/
  api/analyze/route.ts       # Validates requests and streams analysis progress
  api/documents/extract/     # Streams and extracts PDF/DOCX/TXT/MD for LLM structuring
  api/github/                # Repository Search and repository-to-idea generation APIs
  api/community/normalize/    # AI cleanup and public-idea duplicate suggestions
  globals.css                # Responsive light/dark application styles
  layout.tsx                 # Metadata, manifest, and preview bridge
components/
  market-app.tsx             # Navigation, storage, PWA, and analysis flow
  views/                     # Home, form, report, GitHub explorer, community, and saved screens
  ui/                        # Reusable button and badge primitives
lib/
  contracts.ts               # Shared request, document, repository, community, and report schemas
  community-utils.ts         # Public/private filtering, query, category, and sort logic
  server/analyze.ts           # LLM query planning, Tavily search, and evidence analysis
  server/documents.ts        # File-signature checks and in-memory text extraction
  server/github.ts           # GitHub search filters and official-response mapping
  server/search.ts            # URL normalization, de-duplication, and grounding checks
  supabase/client.ts         # Browser anon client; no service-role key
supabase/
  schema.sql                  # Category, idea, vote tables, indexes, and RLS policies
public/
  manifest.webmanifest
  sw.js
  icon.svg
tests/
  search.test.ts
  expansion.test.ts
```

## Environment

Copy `.env.example` to `.env.local` for local development and provide:

```dotenv
TAVILY_API_KEY=your_tavily_key
LLM_API_KEY=your_llm_key
LLM_BASE_URL=https://api.baze.co/v1/gateway
LLM_MODEL=gemini-3.8-flash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GITHUB_TOKEN=
```

`LLM_BASE_URL` is the provider's OpenAI-compatible API base URL. `LLM_MODEL` must be enabled for your account. The defaults point to the BAZE Gateway and the model ID selected for this project; change them if your BAZE account uses another model. Never use a `NEXT_PUBLIC_` variable for either key.

Create a Tavily key from [Tavily](https://app.tavily.com/home) and a BAZE Gateway key from your BAZE account. The server reads secrets from the environment and does not return them to the browser. If a key is missing, analysis requests stop with a configuration message instead of using sample results.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public client configuration values, not service-role secrets. They are sent to the browser and are safe only when Row Level Security is enabled. Never put a service-role key in a `NEXT_PUBLIC_` variable. `GITHUB_TOKEN` is optional and server-only; without it, public GitHub search works subject to GitHub's lower unauthenticated search limit.

### Enable Shared Community Ideas

1. Set the Supabase project URL and anon/publishable key in `.env.local`.
2. In Supabase Auth settings, enable Anonymous Sign-Ins.
3. Run `supabase/schema.sql` in the Supabase SQL Editor. It creates the categories, ideas and votes tables, indexes, grants, and Row Level Security policies.
4. Restart the Next.js server. The community page signs in anonymously and uses RLS for public ideas, owner-only private ideas, and one vote per anonymous user per public idea.

If either public Supabase variable is missing, the board enters an explicitly labeled browser-local demo mode. Demo posts and votes are not visible to other devices and demo privacy is not account-backed. If Supabase is configured but the schema/Auth setup is incomplete, the board reports a connection/configuration error rather than silently falling back to local data.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The development server binds to `0.0.0.0` for preview environments. Analysis requires both API keys and an internet connection.

## API Flow

1. `POST /api/analyze` validates the input and checks that both server keys exist.
2. The LLM creates a small set of Korean and English search queries from the submitted idea.
3. Tavily searches those queries concurrently. Results are URL-normalized and de-duplicated.
4. The LLM receives only the collected search evidence and returns structured analysis.
5. Zod validates the response. Competitors without valid source IDs are discarded, and website links are kept only when their exact normalized URL appears in the collected evidence.
6. The route streams the current analysis stage and final report. Search failure or an empty result set is returned as an error; no competitor list is substituted.

Search-result text is treated as untrusted data, not as system instructions. Analysis is advisory: public search results cannot establish market size, demand, or probability of success. Verify source pages and test demand with prospective users.

## Expansion Flows

- Document upload is streamed through a 10MB multipart limit, checks extension against the actual PDF signature, UTF-8 content or DOCX ZIP entries, extracts text in memory, and sends only the extracted text and filename to the configured LLM for structured fields. No uploaded file is written to disk or a database. Parsing is bounded to 100 PDF pages and 24,000 extracted characters. Scanned/image PDFs are not OCR'd and receive a clear message.
- GitHub discovery calls the official `GET /search/repositories` endpoint. “Trending” is not claimed: filters use public repository search qualifiers and stars/update sorting. “Recent creation” sorts only the API page of popular results locally, so its limitation is disclosed. AI ideas use repository metadata returned by GitHub; stars are never treated as customer demand.
- Community AI cleanup receives the current user's submitted text and public candidate posts only. When Supabase is configured, the server fetches public duplicate candidates using the caller's anon JWT and Supabase RLS; it does not use a service-role key or send private posts. AI similarity suggestions are not a definitive duplicate decision.

## PWA

The web manifest and SVG app icon are in `public/`. In production, the client registers `public/sw.js`; it caches the app shell and same-origin static assets, and does not cache `/api` responses. Offline users can reopen the cached app and their locally stored reports, but new searches are disabled. PWA installation and service-worker behavior should be tested over HTTPS (or localhost) in a production build.

```bash
npm run build
npm run start
```

In Chromium-based browsers, check the browser's install option and Application panel. On iOS Safari, use Share > Add to Home Screen. This starter uses an SVG manifest icon; for store-grade install artwork, add platform-specific 192px and 512px PNG icon files.

## Storage and Privacy

Saved reports are kept only in the current browser's LocalStorage. They are not shared across browsers or devices and may be cleared by the user or browser. Export a Markdown copy for long-term storage. Idea text is sent to the configured LLM provider and search queries are sent to Tavily when analysis is requested; review those providers' data policies before using sensitive information.

The request limiter allows five analysis requests per minute per forwarded address in each running process. This is a best-effort safeguard for the MVP; serverless instances do not share in-memory counters. A production deployment with meaningful traffic should use a shared rate-limit store and provider-side usage limits.

Uploaded document bytes are processed in memory and are not retained by this app. The extracted document text is sent to the configured LLM provider for structuring. GitHub search is server-proxied and contains no user credentials unless the optional server-only GitHub token is configured. Community ideas are public by default; a private idea is visible only to the anonymous Supabase account that created it when the schema's RLS policies are active. Anonymous Supabase sessions can be lost when browser storage is cleared, so users may lose access to their private ideas.

## Checks

```bash
npm test
npm run typecheck
npm run build
```

## Current Limits

- Search coverage depends on Tavily results, query phrasing, the selected target market, and the LLM's ability to follow the structured prompt.
- The MVP checks that competitor names cite collected search-source IDs and blocks fabricated website links. It does not independently prove every generated sentence against the full text of a source.
- Demand checks are research suggestions, not measured demand or a market-size estimate.
- Saved analysis is browser-local; there is no cross-device report sync.
- Scanned PDF OCR, DOC/PPT/ODT and cloud file storage are not implemented.
- GitHub search results are Repository Search API results, not the official Trending page. The recent-created view reorders a popularity-ranked API result page.
- The community board is shared only after Supabase environment values, Anonymous Sign-Ins, `supabase/schema.sql`, and RLS setup are complete. Missing settings use the explicitly labeled local demo mode.
- Anonymous Supabase identities are browser-scoped and can be lost with browser data; there is no account recovery or moderation/admin console yet.
- The simple process-local rate limiter is not a distributed production limit.
- PWA offline behavior is limited to the cached app shell and static resources; analysis APIs are intentionally never cached.

## Next Iteration

- Add independent claim-to-source validation and evidence-level search reranking.
- Add OpenAlex and Semantic Scholar as separate search adapters.
- Add OCR for scanned documents after evaluating privacy, size, and cost controls.
- Add user interview notes and community-demand evidence without presenting them as measured demand.
- Add a moderation/reporting workflow and an account-recovery option for community submissions.
- Replace process-local request limits with a shared store and add provider usage monitoring.
- Add dedicated 192px/512px PNG install icons and automated production PWA checks.
