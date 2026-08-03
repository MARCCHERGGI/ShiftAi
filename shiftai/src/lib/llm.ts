/**
 * Multi-provider LLM router. Free-tier first, paid as fallback.
 *
 * Provider order:
 *   - WEB SEARCH:   Gemini (free, native Google grounding) → free keyless search
 *                   (DuckDuckGo + page reading + Groq synthesis) → OpenAI (paid) → no-search chat
 *   - JSON EXTRACT: Groq → Gemini → OpenAI → OpenRouter
 *   - CHAT:         Groq (fast, free) → OpenRouter (free) → Gemini → OpenAI
 *   - CHAT STREAM:  Groq → OpenRouter → Gemini (faked chunks) → OpenAI
 *
 * Get keys (free):
 *   - GEMINI_API_KEY: aistudio.google.com (15 RPM, 1500 RPD on 2.5 Flash)
 *   - GROQ_API_KEY:   console.groq.com    (30 RPM Llama-3.3-70B)
 *   - OPENROUTER_API_KEY: openrouter.ai/keys (free models available)
 *   - OPENAI_API_KEY: optional paid fallback
 */

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_FAST_MODEL = process.env.GROQ_FAST_MODEL || "llama-3.1-8b-instant";
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL || "gpt-4o";

type Role = "system" | "user" | "assistant";

export interface LLMMessage {
  role: Role;
  content: string;
}

export interface LLMStatus {
  available: boolean;
  webSearchAvailable: boolean;
  providers: { gemini: boolean; groq: boolean; openrouter: boolean; openai: boolean };
}

export function llmStatus(): LLMStatus {
  return {
    available: !!(GEMINI_KEY || GROQ_KEY || OPENROUTER_KEY || OPENAI_KEY),
    // Keyless DuckDuckGo search means grounding works whenever ANY chat provider does.
    webSearchAvailable: !!(GEMINI_KEY || GROQ_KEY || OPENROUTER_KEY || OPENAI_KEY),
    providers: {
      gemini: !!GEMINI_KEY,
      groq: !!GROQ_KEY,
      openrouter: !!OPENROUTER_KEY,
      openai: !!OPENAI_KEY,
    },
  };
}

/* ────────────────────────────  WEB SEARCH  ──────────────────────────── */

export interface WebSearchOpts {
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
}

export interface WebSearchResult {
  text: string;
  groundingUrls: string[];
  provider: string;
}

export async function runWebSearch(opts: WebSearchOpts): Promise<WebSearchResult> {
  if (GEMINI_KEY) {
    try {
      return await runGeminiWithSearch(opts);
    } catch (err) {
      // Free tier is 20 req/min; parallel agents can trip it. The 429 asks for
      // a sub-second retry, so one short wait usually keeps us on the free path.
      if (err instanceof Error && err.message.includes("429")) {
        await new Promise((r) => setTimeout(r, 1_500));
        try {
          return await runGeminiWithSearch(opts);
        } catch (err2) {
          console.warn("[llm] Gemini web-search failed after 429 retry:", err2);
        }
      } else {
        console.warn("[llm] Gemini web-search failed, falling back:", err);
      }
    }
  }
  if (GROQ_KEY || OPENROUTER_KEY) {
    try {
      return await runFreeSearch(opts);
    } catch (err) {
      console.warn("[llm] free web-search failed, falling back:", err);
    }
  }
  if (OPENAI_KEY) {
    try {
      return await runOpenAIWithSearch(opts);
    } catch (err) {
      console.warn("[llm] OpenAI web-search failed:", err);
    }
  }
  // Last resort: no real grounding, just LLM reasoning over the prompt.
  const text = await runChat({
    system: `${opts.systemPrompt}\n\nIMPORTANT: You have NO live web access right now. State only facts you are highly confident about from training data. For specific names, dates, ratings, or menu items you are not certain of, say "not found" instead — NEVER guess or invent a name.`,
    messages: [{ role: "user", content: opts.userPrompt }],
    maxTokens: opts.maxOutputTokens,
  });
  return { text, groundingUrls: [], provider: "no-search-fallback" };
}

async function runGeminiWithSearch(opts: WebSearchOpts): Promise<WebSearchResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const body = {
    systemInstruction: { parts: [{ text: opts.systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const j = (await res.json()) as GeminiResponse;
  const cand = j.candidates?.[0];
  const text =
    cand?.content?.parts
      ?.map((p) => p.text ?? "")
      .filter(Boolean)
      .join("") ?? "";
  const groundingUrls: string[] = [];
  const chunks = cand?.groundingMetadata?.groundingChunks ?? [];
  for (const c of chunks) {
    if (c.web?.uri) groundingUrls.push(c.web.uri);
  }
  // Gemini sometimes returns an empty candidate (safety/recitation block).
  // Treat as failure so the router falls through to the keyless search path.
  if (!text.trim()) throw new Error("Gemini returned empty text");
  return { text, groundingUrls, provider: "gemini" };
}

/* ── Free keyless search: DuckDuckGo → read top pages → Groq synthesis ── */

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

interface DdgHit {
  title: string;
  url: string;
  snippet: string;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeDdgHref(href: string): string | null {
  // DDG wraps results: //duckduckgo.com/l/?uddg=<encoded>&rut=...
  const m = href.match(/[?&]uddg=([^&]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  }
  if (href.startsWith("http")) return href;
  return null;
}

async function ddgSearch(query: string, signal?: AbortSignal): Promise<DdgHit[]> {
  const res = await fetch(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    { headers: { "user-agent": BROWSER_UA }, signal },
  );
  if (!res.ok) throw new Error(`DDG ${res.status}`);
  const html = await res.text();
  const hits: DdgHit[] = [];
  const blocks = html.split(/class="result\b/).slice(1);
  for (const block of blocks) {
    const a = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const url = decodeDdgHref(a[1]);
    if (!url) continue;
    const snip = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    hits.push({
      title: htmlToText(a[2]),
      url,
      snippet: snip ? htmlToText(snip[1]) : "",
    });
    if (hits.length >= 8) break;
  }
  return hits;
}

/** DDG lite endpoint — simpler markup, sometimes reachable where /html/ is blocked. */
async function ddgLiteSearch(query: string): Promise<DdgHit[]> {
  const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
    headers: { "user-agent": BROWSER_UA, "accept-language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`DDG-lite ${res.status}`);
  const html = await res.text();
  const hits: DdgHit[] = [];
  const links = [...html.matchAll(/class=['"]result-link['"][^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/g)];
  const snippets = [...html.matchAll(/class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/g)];
  for (let i = 0; i < links.length && hits.length < 8; i++) {
    const url = decodeDdgHref(links[i][1]);
    if (!url) continue;
    hits.push({
      title: htmlToText(links[i][2]),
      url,
      snippet: htmlToText(snippets[i]?.[1] ?? "").slice(0, 300),
    });
  }
  return hits;
}

async function anySearch(query: string): Promise<DdgHit[]> {
  try {
    const hits = await ddgSearch(query, AbortSignal.timeout(8_000));
    if (hits.length > 0) return hits;
    throw new Error("DDG returned no results");
  } catch (err) {
    console.warn("[llm] DDG failed, trying DDG-lite:", err);
    return ddgLiteSearch(query);
  }
}

async function fetchReadable(url: string): Promise<string> {
  const ctrl = AbortSignal.timeout(6000);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": BROWSER_UA, accept: "text/html,*/*" },
      signal: ctrl,
      redirect: "follow",
    });
    if (res.ok) {
      const text = htmlToText(await res.text());
      if (text.length > 400) return text.slice(0, 4000);
    }
  } catch {
    /* page unreadable — snippet-only is still useful */
  }
  return "";
}

async function runFreeSearch(opts: WebSearchOpts): Promise<WebSearchResult> {
  // 1. Turn the research task into one tight search query (fast model).
  let query = "";
  try {
    query = (
      await runChat({
        system:
          "You turn a research task into ONE web search query. Reply with the query text only — no quotes, no commentary, under 12 words.",
        messages: [{ role: "user", content: opts.userPrompt.slice(0, 1500) }],
        maxTokens: 40,
        fast: true,
      })
    )
      .replace(/^["']|["']$/g, "")
      .trim();
  } catch {
    /* fall back to raw prompt words */
  }
  if (!query) query = opts.userPrompt.split(/\s+/).slice(0, 10).join(" ");

  // 2. Search + read the top pages in parallel.
  const hits = await anySearch(query);
  if (hits.length === 0) throw new Error("search returned no results");
  const top = hits.slice(0, 3);
  const pages = await Promise.all(top.map((h) => fetchReadable(h.url)));

  // 3. Synthesize with a free chat model over real page content.
  const evidence = top
    .map((h, i) => {
      const body = pages[i] ? `\nPAGE CONTENT: ${pages[i]}` : "";
      return `[${i + 1}] ${h.title}\nURL: ${h.url}\nSNIPPET: ${h.snippet}${body}`;
    })
    .join("\n\n---\n\n")
    .slice(0, 14000);
  const extraSnippets = hits
    .slice(3)
    .map((h) => `- ${h.title}: ${h.snippet}`)
    .join("\n");
  const text = await runChat({
    system: `${opts.systemPrompt}\n\nYou are given real web search results with page content. Answer ONLY from this evidence. If the evidence does not contain something, say it was not found — never invent facts.`,
    messages: [
      {
        role: "user",
        content: `TASK: ${opts.userPrompt}\n\nSEARCH QUERY USED: ${query}\n\nEVIDENCE:\n${evidence}\n\nOTHER RESULT SNIPPETS:\n${extraSnippets}`,
      },
    ],
    maxTokens: opts.maxOutputTokens ?? 2048,
  });
  if (!text.trim()) throw new Error("free-search synthesis returned empty text");
  return { text, groundingUrls: top.map((h) => h.url), provider: "free-search" };
}

async function runOpenAIWithSearch(opts: WebSearchOpts): Promise<WebSearchResult> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: OPENAI_KEY! });
  const params: Record<string, unknown> = {
    model: OPENAI_SEARCH_MODEL,
    input: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
    tools: [{ type: "web_search_preview" }],
    tool_choice: "auto",
    max_output_tokens: opts.maxOutputTokens ?? 4096,
  };
  const res = await client.responses.create(params as never);
  const text = ((res as { output_text?: string }).output_text ?? "").trim();
  if (!text) throw new Error("OpenAI returned empty text");
  return { text, groundingUrls: [], provider: "openai" };
}

/* ────────────────────────────  STRUCTURED EXTRACT  ──────────────────────────── */

export interface StructuredExtractOpts {
  systemPrompt: string;
  userPrompt: string;
  /** JSON Schema describing the desired output shape. */
  schema: object;
  maxTokens?: number;
}

export async function runStructuredExtract<T>(opts: StructuredExtractOpts): Promise<T> {
  const errs: string[] = [];
  const tries: Array<[string, () => Promise<T>]> = [];
  if (GROQ_KEY) tries.push(["groq", () => runGroqJSON<T>(opts)]);
  if (GEMINI_KEY) tries.push(["gemini", () => runGeminiJSON<T>(opts)]);
  if (OPENROUTER_KEY) tries.push(["openrouter", () => runOpenRouterJSON<T>(opts)]);
  if (OPENAI_KEY) tries.push(["openai", () => runOpenAIJSON<T>(opts)]);
  if (tries.length === 0) {
    throw new Error("No LLM provider configured (set GEMINI_API_KEY or GROQ_API_KEY)");
  }
  for (const [name, fn] of tries) {
    try {
      return await fn();
    } catch (err) {
      errs.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`All providers failed: ${errs.join(" | ")}`);
}

async function runGroqJSON<T>(opts: StructuredExtractOpts): Promise<T> {
  const sys = `${opts.systemPrompt}\n\nReturn ONLY a JSON object that matches this schema (no markdown, no fences, no commentary):\n${JSON.stringify(opts.schema)}`;
  const call = async (model: string) => {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: opts.userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: opts.maxTokens ?? 4096,
      }),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text().catch(() => "")}`);
    const j = (await res.json()) as OpenAIChatResponse;
    return JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as T;
  };
  try {
    return await call(GROQ_MODEL);
  } catch (err) {
    // 70B and 8B have SEPARATE free-tier daily token pools — degrade, stay free.
    if (err instanceof Error && err.message.includes("429")) {
      console.warn("[llm] Groq 70B rate-limited, degrading to fast model");
      return call(GROQ_FAST_MODEL);
    }
    throw err;
  }
}

async function runGeminiJSON<T>(opts: StructuredExtractOpts): Promise<T> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const body = {
    systemInstruction: { parts: [{ text: opts.systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: opts.schema,
      maxOutputTokens: opts.maxTokens ?? 4096,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text().catch(() => "")}`);
  const j = (await res.json()) as GeminiResponse;
  const text =
    j.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .filter(Boolean)
      .join("") ?? "{}";
  return JSON.parse(text) as T;
}

async function runOpenRouterJSON<T>(opts: StructuredExtractOpts): Promise<T> {
  const sys = `${opts.systemPrompt}\n\nReturn ONLY a JSON object matching this schema (no markdown, no fences):\n${JSON.stringify(opts.schema)}`;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: opts.userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: opts.maxTokens ?? 4096,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text().catch(() => "")}`);
  const j = (await res.json()) as OpenAIChatResponse;
  return JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as T;
}

async function runOpenAIJSON<T>(opts: StructuredExtractOpts): Promise<T> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: OPENAI_KEY! });
  const params: Record<string, unknown> = {
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
    text: {
      format: { type: "json_schema", name: "result", strict: true, schema: opts.schema },
    },
    max_output_tokens: opts.maxTokens ?? 4096,
  };
  const res = await client.responses.create(params as never);
  return JSON.parse(((res as { output_text?: string }).output_text ?? "{}")) as T;
}

/* ────────────────────────────  CHAT (non-stream)  ──────────────────────────── */

export interface ChatOpts {
  system: string;
  messages: LLMMessage[];
  maxTokens?: number;
  fast?: boolean;
}

export async function runChat(opts: ChatOpts): Promise<string> {
  const errs: string[] = [];
  const tries: Array<[string, () => Promise<string>]> = [];
  if (GROQ_KEY) tries.push(["groq", () => runGroqChat(opts)]);
  if (OPENROUTER_KEY) tries.push(["openrouter", () => runOpenRouterChat(opts)]);
  if (GEMINI_KEY) tries.push(["gemini", () => runGeminiChat(opts)]);
  if (OPENAI_KEY) tries.push(["openai", () => runOpenAIChat(opts)]);
  if (tries.length === 0) {
    throw new Error("No LLM provider configured");
  }
  for (const [name, fn] of tries) {
    try {
      return await fn();
    } catch (err) {
      errs.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`All providers failed: ${errs.join(" | ")}`);
}

async function runGroqChat(opts: ChatOpts): Promise<string> {
  const call = async (model: string) => {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: opts.system }, ...opts.messages],
        temperature: 0.4,
        max_tokens: opts.maxTokens ?? 1024,
      }),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text().catch(() => "")}`);
    const j = (await res.json()) as OpenAIChatResponse;
    return j.choices?.[0]?.message?.content ?? "";
  };
  const primary = opts.fast ? GROQ_FAST_MODEL : GROQ_MODEL;
  try {
    return await call(primary);
  } catch (err) {
    if (primary !== GROQ_FAST_MODEL && err instanceof Error && err.message.includes("429")) {
      console.warn("[llm] Groq 70B rate-limited, degrading to fast model");
      return call(GROQ_FAST_MODEL);
    }
    throw err;
  }
}

async function runGeminiChat(opts: ChatOpts): Promise<string> {
  const contents = opts.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents,
    generationConfig: { temperature: 0.4, maxOutputTokens: opts.maxTokens ?? 1024 },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text().catch(() => "")}`);
  const j = (await res.json()) as GeminiResponse;
  return (
    j.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .filter(Boolean)
      .join("") ?? ""
  );
}

async function runOpenRouterChat(opts: ChatOpts): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
      temperature: 0.4,
      max_tokens: opts.maxTokens ?? 1024,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text().catch(() => "")}`);
  const j = (await res.json()) as OpenAIChatResponse;
  return j.choices?.[0]?.message?.content ?? "";
}

async function runOpenAIChat(opts: ChatOpts): Promise<string> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: OPENAI_KEY! });
  const res = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: opts.system },
      ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature: 0.4,
    max_tokens: opts.maxTokens ?? 1024,
  });
  return res.choices[0]?.message?.content ?? "";
}

/* ────────────────────────────  CHAT STREAM  ──────────────────────────── */

export interface ChatStreamOpts {
  system: string;
  messages: LLMMessage[];
  maxTokens?: number;
  onDelta: (text: string) => void;
}

export async function runChatStream(
  opts: ChatStreamOpts,
): Promise<{ provider: string; full: string }> {
  const errs: string[] = [];
  const tries: Array<[string, () => Promise<{ provider: string; full: string }>]> = [];
  if (GROQ_KEY) tries.push(["groq", () => streamGroq(opts)]);
  if (OPENROUTER_KEY) tries.push(["openrouter", () => streamOpenRouter(opts)]);
  if (GEMINI_KEY) tries.push(["gemini", () => streamGeminiFake(opts)]);
  if (OPENAI_KEY) tries.push(["openai", () => streamOpenAI(opts)]);
  if (tries.length === 0) {
    throw new Error("No LLM provider configured");
  }
  for (const [name, fn] of tries) {
    try {
      return await fn();
    } catch (err) {
      errs.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`All providers failed: ${errs.join(" | ")}`);
}

async function streamSseChat(
  url: string,
  apiKey: string,
  model: string,
  opts: ChatStreamOpts,
  provider: string,
): Promise<{ provider: string; full: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
      temperature: 0.4,
      stream: true,
      max_tokens: opts.maxTokens ?? 1024,
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`${provider} stream ${res.status}: ${await res.text().catch(() => "")}`);
  }
  let full = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload) as OpenAIStreamChunk;
        const delta = j.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          opts.onDelta(delta);
        }
      } catch {
        /* ignore parse errors on partial chunks */
      }
    }
  }
  return { provider, full };
}

function streamGroq(opts: ChatStreamOpts) {
  return streamSseChat(
    "https://api.groq.com/openai/v1/chat/completions",
    GROQ_KEY!,
    GROQ_MODEL,
    opts,
    "groq",
  );
}

function streamOpenRouter(opts: ChatStreamOpts) {
  return streamSseChat(
    "https://openrouter.ai/api/v1/chat/completions",
    OPENROUTER_KEY!,
    OPENROUTER_MODEL,
    opts,
    "openrouter",
  );
}

async function streamGeminiFake(
  opts: ChatStreamOpts,
): Promise<{ provider: string; full: string }> {
  // Gemini's REST streaming is messier; non-stream + fake-chunk is fine UX-wise.
  const text = await runGeminiChat({
    system: opts.system,
    messages: opts.messages,
    maxTokens: opts.maxTokens,
  });
  let full = "";
  const size = 18;
  for (let i = 0; i < text.length; i += size) {
    const chunk = text.slice(i, i + size);
    full += chunk;
    opts.onDelta(chunk);
    await new Promise((r) => setTimeout(r, 14));
  }
  return { provider: "gemini-faux-stream", full };
}

async function streamOpenAI(
  opts: ChatStreamOpts,
): Promise<{ provider: string; full: string }> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: OPENAI_KEY! });
  const stream = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: opts.system },
      ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature: 0.4,
    stream: true,
    max_tokens: opts.maxTokens ?? 1024,
  });
  let full = "";
  for await (const evt of stream) {
    const delta = evt.choices?.[0]?.delta?.content ?? "";
    if (delta) {
      full += delta;
      opts.onDelta(delta);
    }
  }
  return { provider: "openai", full };
}

/* ────────────────────────────  RESPONSE TYPES  ──────────────────────────── */

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
  }>;
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface OpenAIStreamChunk {
  choices?: Array<{ delta?: { content?: string } }>;
}
