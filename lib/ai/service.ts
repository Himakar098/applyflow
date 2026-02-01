import { OpenAIProvider } from "@/lib/ai/providers/openai";
import type { AIProvider } from "@/lib/ai/types";

export const aiProvider: AIProvider = new OpenAIProvider();
