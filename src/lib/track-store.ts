import { Redis } from "@upstash/redis";

const KEY = "shiftai:events";
const MAX_EVENTS = 5000;

type StoredEvent = {
  name: string;
  props: Record<string, unknown>;
  ts: number;
  ua?: string;
  ip?: string;
  country?: string;
  city?: string;
};

const redis = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
})();

export async function pushEvent(evt: StoredEvent): Promise<void> {
  if (!redis) return;
  try {
    await redis.lpush(KEY, JSON.stringify(evt));
    await redis.ltrim(KEY, 0, MAX_EVENTS - 1);
  } catch (err) {
    console.error("[track-store] push failed", err);
  }
}

export async function recentEvents(limit = 500): Promise<StoredEvent[]> {
  if (!redis) return [];
  try {
    const raw = await redis.lrange(KEY, 0, limit - 1);
    return raw
      .map((s) => {
        try {
          return typeof s === "string" ? (JSON.parse(s) as StoredEvent) : (s as StoredEvent);
        } catch {
          return null;
        }
      })
      .filter((e): e is StoredEvent => e !== null);
  } catch (err) {
    console.error("[track-store] read failed", err);
    return [];
  }
}

export function hasStorage(): boolean {
  return !!redis;
}
