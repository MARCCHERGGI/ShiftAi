/**
 * Browser helper for the agent crew.
 *
 * runCrew POSTs to /api/agents/analyze and incrementally parses the SSE
 * response (fetch + ReadableStream — EventSource can't POST). Every
 * CrewEvent is forwarded to onEvent for live UI; the promise resolves
 * with the AnalyzeResult carried by the crew/complete event and rejects
 * on crew/error (or a dropped stream).
 */

import type { AnalyzeResult, CrewEvent } from "@/src/lib/agents/types";

export class CrewRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrewRunError";
  }
}

export async function runCrew(
  input: { url?: string; text?: string },
  onEvent: (e: CrewEvent) => void,
): Promise<AnalyzeResult> {
  let res: Response;
  try {
    res = await fetch("/api/agents/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new CrewRunError("Couldn't reach the crew. Check your connection and try again.");
  }

  if (!res.ok || !res.body) {
    throw new CrewRunError(`The crew failed to start (${res.status}). Try again.`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AnalyzeResult | null = null;

  const handleBlock = (block: string): void => {
    // An SSE message block: one or more lines; data lines start with "data:".
    const dataLines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim());
    if (dataLines.length === 0) return;
    const payload = dataLines.join("\n");
    if (!payload || payload === "[DONE]") return;

    let evt: CrewEvent;
    try {
      evt = JSON.parse(payload) as CrewEvent;
    } catch {
      return; // ignore malformed frames
    }
    if (!evt || typeof evt !== "object" || !("agent" in evt) || !("status" in evt)) return;

    onEvent(evt);

    if (evt.agent === "crew" && evt.status === "complete") {
      result = evt.data as AnalyzeResult;
    }
    if (evt.agent === "crew" && evt.status === "error") {
      throw new CrewRunError(evt.message ?? "The crew hit an error.");
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        handleBlock(block);
      }
    }
    // Flush any trailing frame that arrived without a final blank line.
    buffer += decoder.decode();
    if (buffer.trim()) handleBlock(buffer);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* stream already closed */
    }
  }

  if (!result) {
    throw new CrewRunError("The crew stream ended before finishing. Try again.");
  }
  return result;
}
