# Shift AI — free AI job prep for bartenders

**Live: [shiftai-six.vercel.app](https://shiftai-six.vercel.app)** · free for everyone · MIT-licensed

Paste a job link. An AI agent crew researches the venue — menu, management, reviews — then builds you a tailored resume and runs a venue-specific mock interview. Built for NYC bartenders; works for any hospitality role.

## The agent crew

| Agent | What it does |
|---|---|
| **Scout** | Fetches and parses the job listing (Craigslist, Indeed, Culinary Agents, any URL — or pasted text) |
| **Venue** | Identifies the actual restaurant/bar behind the listing |
| **Menu** | Researches the menu, signature cocktails, spirits focus |
| **People** | Researches ownership, management, venue history |
| **Reviews** | Reads customer reviews — what guests praise, what they complain about, what they say about staff |
| **Synthesis** | Merges everything into a walk-in plan: talking points, questions to ask, red flags, fit score |

Then:
- **Resume** — a one-page, ATS-friendly PDF tailored to that venue
- **Mock interview** — 6 questions the venue would actually ask (built from its real menu and reviews), scored with honest feedback

Plus **Jobs**: verified Manhattan walk-in bartender listings pulled hourly from Craigslist with an AI scam filter (fee asks, ID/bank requests, off-platform redirects all blocked). One tap preps any listing.

## 100% free to run

The whole stack runs on free tiers:

- **Groq** (free) — fast Llama 3.3 70B for extraction, synthesis, scoring
- **Keyless web search** — DuckDuckGo + page reading, no API key at all
- **Gemini** (free, optional) — native Google-grounded search when a key is set
- **OpenAI** (optional) — last-resort fallback only; never hit when the free path works

## Self-host

```bash
git clone https://github.com/MARCCHERGGI/ShiftAi
cd ShiftAi/shiftai
npm install
echo "GROQ_API_KEY=gsk_..." > .env.local   # free at console.groq.com — the ONLY required key
npm run dev
```

Optional extras in `.env.example`: `GEMINI_API_KEY` (better venue research, free at aistudio.google.com), `OPENAI_API_KEY` (paid fallback), `ADMIN_TOKEN` (usage dashboard at `/admin`).

Deploy anywhere Next.js 15 runs. On Vercel: push, import, add `GROQ_API_KEY`, done.

## Install as an app

The site is a full PWA — on iPhone: Share → **Add to Home Screen**. Standalone window, offline shell, iOS-native UI (Apple HIG: SF type, tab bar, grouped lists).

## Stack

Next.js 15 · TypeScript · SSE-streamed agent pipeline · pdf-lib · zero paid dependencies

MIT — do whatever you want with it.
