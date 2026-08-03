# Shift AI v3 — downloadable multi-agent app for bartenders

One paste of a job link → an agent crew researches the venue → tailored resume + venue-specific mock interview. iOS-native feel (Apple HIG), installable as a PWA.

## Non-negotiables

- **Contracts**: everything codes against `src/lib/agents/types.ts`. Never fork those types.
- **LLM access**: ONLY via `src/lib/llm.ts` (`runWebSearch`, `runStructuredExtract`, `runChat`, `runChatStream`). Providers configured: Groq (fast, free — prefer for extract/chat) and OpenAI (paid — the web-search stage falls back to it since Gemini is unset). Never import `openai` directly, never add API keys.
- **No new runtime deps.** `pdf-lib`, `lucide-react` already installed. `sharp` may be added as **devDependency** only (icon generation).
- **Design = Apple HIG, light mode only.** SF system font stack, iOS system colors, 4pt grid, 44pt touch targets, grouped inset lists, large titles, bottom tab bar with translucency (`backdrop-filter: blur(20px) saturate(180%)`), safe-area env() insets, continuous-corner cards (radius 16-20). Liquid-glass accents welcome, HIG structure mandatory.
- **Analytics**: fire `trackEvent(name, props)` from `src/lib/track.ts` on key actions (crew_start, crew_complete, crew_error, resume_generate, resume_pdf, interview_start, interview_complete, tab_nav).
- **TypeScript strict, Next 15 App Router.** Client components `"use client"`. API routes: Node runtime, `export const maxDuration = 60`.

## Screens (bottom tab bar, 5 tabs)

1. **Prep** `/` — hero input (paste link OR listing text), "Run the crew" → live agent progress (6 agents lighting up via SSE) → result: venue card, menu / people / reviews intel cards, synthesis (walk-in plan, talking points, questions to ask, red flags, fit score ring). Saves result to `LS_ANALYSIS`.
2. **Jobs** `/jobs` — the existing verified-Craigslist listings UI (currently in `src/app/page.tsx`) moved here and restyled iOS. Each listing gets "Prep this job" → router.push to `/?url=<listing url>` which auto-runs the crew.
3. **Resume** `/resume` — reads profile + last analysis, "Generate" → ResumeDoc rendered as an iOS card resume preview, "Download PDF" button.
4. **Interview** `/interview` — chat-style mock interview (bubbles), score per answer, progress dots (6 questions), final report card with overall score + tips.
5. **Profile** `/profile` — grouped inset form for the `Profile` type, saved to `LS_PROFILE` on change.

## File ownership (parallel build — do NOT touch files outside your set)

### W1 — agent crew backend
- `src/lib/agents/fetchJob.ts` — fetch a job URL server-side (desktop UA, 10s timeout, follow redirects), strip HTML → clean text. Handles craigslist/indeed/generic; on fetch failure throw a typed error the route reports (client then asks user to paste text).
- `src/lib/agents/crew.ts` — the 6 agents as functions. scout: `runStructuredExtract` → JobExtract (from fetched text or pasted text). venue: `runWebSearch` ("<venueName> <neighborhood> NYC bar restaurant — what is this place") + `runStructuredExtract` → VenueIntel; when JobExtract.venueName is null, attempt inference from listing clues, confidence "low"; if hopeless return null. menu/people/reviews: run in PARALLEL, each `runWebSearch` with a targeted query + `runStructuredExtract` → their Intel types; each independently null on failure. synthesis: `runChat` (Groq) over all prior JSON → Synthesis. Bartender-first prompt voice throughout: the user is a bartender walking into this venue.
- `src/app/api/agents/analyze/route.ts` — POST `{url?: string, text?: string}` → SSE stream of `CrewEvent` (see types). Emit start/done per agent, `crew/complete` with AnalyzeResult last. Errors per-agent don't kill the run (that agent → error + null); scout failure DOES kill the run (crew/error).
- `src/lib/agents/client.ts` — browser helper `runCrew(input: {url?: string; text?: string}, onEvent: (e: CrewEvent) => void): Promise<AnalyzeResult>` using fetch + ReadableStream SSE parsing.

### W2 — resume + interview backend
- `src/lib/resume/build.ts` — `buildResume(profile, analysis): Promise<ResumeDoc>` via `runStructuredExtract` (Groq). Quantified bullets, venue-tailored summary/skills when analysis present.
- `src/lib/resume/pdf.ts` — `resumePdf(doc: ResumeDoc, profile: Profile): Promise<Uint8Array>` via `pdf-lib`. Single page, clean typographic hierarchy (Helvetica), name header, thin rules, ATS-friendly.
- `src/app/api/agents/resume/route.ts` — POST ResumeRequest → ResumeResponse; when body has `format:"pdf"` + `resume`, return PDF bytes (`Content-Type: application/pdf`).
- `src/lib/interview/engine.ts` — `interviewTurn(req: InterviewRequest): Promise<InterviewResponse>`. 6 questions: mix of venue-specific (menu/cocktails/reviews from analysis) + classic bartender behaviorals. Score 0-10 with honest, specific feedback. Final: overallScore (avg), verdict, 3 tips.
- `src/app/api/agents/interview/route.ts` — POST wrapper.

### W3 — iOS design system + PWA shell
- `src/components/ios/` — `TabBar.tsx` (5 tabs: Prep/sparkles, Jobs/list, Resume/file-text, Interview/mic, Profile/user — lucide icons, usePathname active state, fixed bottom, translucent, safe-area-bottom), `NavBar.tsx` (`{title, large?, right?}`), `Card.tsx`, `InsetGroup.tsx` (`{header?, footer?, children}`) + `Row.tsx` (`{label, value?, icon?, chevron?, onPress?, children?}`), `PillButton.tsx` (`{children, onPress, variant?: "filled"|"tinted"|"plain", full?, disabled?, loading?}`), `TextField.tsx` (`{label?, value, onChange, placeholder?, multiline?}`), `Sheet.tsx` (`{open, onClose, title?, children}` bottom sheet + grabber), `SegmentedControl.tsx` (`{options: string[], value, onChange}`), `CrewProgress.tsx` (`{steps: {key: AgentKey, label: string, status: AgentStatus}[]}` — vertical agent list, running=spinner, done=check pop), `ScoreRing.tsx` (`{score: number}` 0-100 animated ring).
- `src/app/globals.css` — full rewrite: iOS tokens (system font stack, #007AFF tint, systemGray1-6, systemBackground/secondary grouped bg #F2F2F7, 17px body / 34px large title scale), smooth momentum scroll, `viewport-fit=cover` support, tap highlight removal, spring-ish transitions.
- `src/app/layout.tsx` — keep `PageviewTracker`, Vercel `Analytics`/`SpeedInsights` imports as today; add PWA meta (manifest link, apple-touch-icon, `apple-mobile-web-app-capable`, theme-color, viewport-fit=cover), render `<TabBar/>` after children, register `/sw.js` (small inline script component).
- `public/manifest.json` — name "Shift AI", standalone, start_url "/", icons 192/512 + maskable, theme/background #F2F2F7.
- `public/sw.js` — **network-first for documents/API, cache-first for static assets** (stale-document bug bit us before), versioned cache, skipWaiting+clientsClaim.
- `scripts/gen-icons.mjs` + run it — app icon (rounded-square gradient #0A84FF→#007AFF, white cocktail-glass glyph, "S" fallback fine) → `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png` (180). Add `sharp` as devDep to generate, commit PNGs.

### W4 — pages
- `src/app/page.tsx` — REPLACE with Prep screen (current listings content is being moved to /jobs by you): input state (URL or pasted text via SegmentedControl), `runCrew` from `src/lib/agents/client.ts`, CrewProgress while running, result cards after. Read `?url=` search param → auto-run. Save AnalyzeResult to `LS_ANALYSIS`.
- `src/app/jobs/page.tsx` — port the existing listings UI from current `src/app/page.tsx` (keep `/api/listings` fetch, scam-filter stats, Stripe upsell sheet intact) restyled with ios components; add "Prep this job" per listing.
- `src/app/resume/page.tsx`, `src/app/interview/page.tsx`, `src/app/profile/page.tsx` — per screen specs above.
- `src/lib/store.ts` — typed localStorage helpers: `loadProfile/saveProfile/loadAnalysis/saveAnalysis` (SSR-safe).

## Verification (after integration)

1. `npm run build` clean.
2. Dev server: POST a real NYC bartender job link through /api/agents/analyze → full AnalyzeResult.
3. Resume + interview endpoints return valid shapes.
4. Lighthouse-level PWA sanity: manifest served, SW registers, installable.
5. Deploy: `shiftai-tracking` project, re-alias `shiftai-six.vercel.app`, set GROQ_API_KEY prod env.
