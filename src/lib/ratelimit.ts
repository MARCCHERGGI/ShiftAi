import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

const redis = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
})();

const limiters = redis
  ? {
      analyze:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(8,  "1 m"),  prefix: "rl:analyze",   analytics: true }),
      interview: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 m"),  prefix: "rl:interview", analytics: true }),
      resume:    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(6,  "1 m"),  prefix: "rl:resume",    analytics: true }),
      track:     new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120,"1 m"),  prefix: "rl:track",     analytics: true }),
      global:    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(200,"1 h"),  prefix: "rl:global",    analytics: true }),
    }
  : null;

export type LimiterKey = "analyze" | "interview" | "resume" | "track" | "global";

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "anon";
}

export async function enforceLimit(
  req: NextRequest,
  key: LimiterKey
): Promise<{ ok: true } | { ok: false; retryAfter: number; limit: number; remaining: number }> {
  if (!limiters) return { ok: true };
  const ip = clientIp(req);
  const rl = limiters[key];
  const r = await rl.limit(ip);
  if (r.success) return { ok: true };
  const retryAfter = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
  return { ok: false, retryAfter, limit: r.limit, remaining: r.remaining };
}

export function rateLimitResponse(
  info: { retryAfter: number; limit: number; remaining: number }
) {
  return new Response(
    JSON.stringify({
      error: "Too many requests. Try again in a moment.",
      retryAfter: info.retryAfter,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(info.retryAfter),
        "x-ratelimit-limit": String(info.limit),
        "x-ratelimit-remaining": String(info.remaining),
      },
    }
  );
}
