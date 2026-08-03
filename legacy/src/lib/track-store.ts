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

function upstashConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashCmd(args: (string | number)[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const data = (await res.json()) as { result: unknown };
  return data.result;
}

export async function pushEvent(evt: StoredEvent): Promise<void> {
  if (!upstashConfigured()) return;
  try {
    await upstashCmd(["LPUSH", KEY, JSON.stringify(evt)]);
    await upstashCmd(["LTRIM", KEY, 0, MAX_EVENTS - 1]);
  } catch (err) {
    console.error("[track-store] push failed", err);
  }
}

export async function recentEvents(limit = 500): Promise<StoredEvent[]> {
  if (!upstashConfigured()) return [];
  try {
    const raw = (await upstashCmd(["LRANGE", KEY, 0, limit - 1])) as string[];
    return raw
      .map((s) => {
        try {
          return JSON.parse(s) as StoredEvent;
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
  return upstashConfigured();
}
