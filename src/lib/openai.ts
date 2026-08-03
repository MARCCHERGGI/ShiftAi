import OpenAI from "openai";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "missing",
    });
  }
  return _client;
}

export async function agentCall(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
  }
): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: options?.model || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: options?.maxTokens || 2000,
    temperature: options?.temperature || 0.7,
    ...(options?.jsonMode ? { response_format: { type: "json_object" } } : {}),
  });

  return response.choices[0]?.message?.content || "{}";
}

export async function getAIResponse(prompt: string) {
  return agentCall("You are an AI interview coach.", prompt, { maxTokens: 300 });
}
