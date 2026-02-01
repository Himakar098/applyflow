import type { AIProvider, AIResponse } from "@/lib/ai/types";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export class OpenAIProvider implements AIProvider {
  async summarizeResume(text: string): Promise<AIResponse> {
    if (!OPENAI_API_KEY) {
      return {
        text: "OpenAI API key not configured. Add OPENAI_API_KEY to use AI summaries.",
      };
    }

    const body = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an assistant that distills resumes into crisp bullet points and keywords.",
        },
        {
          role: "user",
          content: `Summarize the following resume text into 4-6 concise bullet points. Keep role titles and quantified impact.\n\n${text.slice(0, 6000)}`,
        },
      ],
      temperature: 0.25,
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI error", error);
      return { text: "Unable to generate AI summary right now." };
    }

    const json = await response.json();
    const textResponse =
      json?.choices?.[0]?.message?.content?.trim() ??
      "AI did not return a summary.";

    return { text: textResponse };
  }
}
