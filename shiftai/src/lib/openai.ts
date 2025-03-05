import { Configuration, OpenAIApi } from "openai";

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY, // Make sure to set this in .env.local
  })
);

export async function getAIResponse(prompt: string) {
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-4", // Use "gpt-4" or "gpt-3.5-turbo"
      messages: [{ role: "system", content: "You are an AI interview coach." }, { role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    return response.data.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Error fetching AI response:", error);
    return "An error occurred. Please try again.";
  }
}

