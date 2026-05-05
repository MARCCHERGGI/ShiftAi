import { Redis } from "@upstash/redis";
import { createHash } from "crypto";

const redis = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
})();

export function hashInput(input: string | object): string {
  const str = typeof input === "string" ? input : JSON.stringify(input);
  return createHash("sha256").update(str).digest("hex").slice(0, 32);
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    return (await redis.get<T>(key)) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = 60 * 60 * 24
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    /* swallow — cache is optional */
  }
}

export async function cachedOrCompute<T>(
  key: string,
  compute: () => Promise<T>,
  ttlSeconds?: number
): Promise<{ value: T; hit: boolean }> {
  const hit = await cacheGet<T>(key);
  if (hit) return { value: hit, hit: true };
  const value = await compute();
  await cacheSet(key, value, ttlSeconds);
  return { value, hit: false };
}
