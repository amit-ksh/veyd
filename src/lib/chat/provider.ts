import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getServerConfig } from "../config";

if (typeof window !== "undefined") {
  throw new Error("Cannot import server model provider in client-side code");
}

let cachedProvider: ReturnType<typeof createGoogleGenerativeAI> | null = null;

export function getGoogleProvider() {
  if (!cachedProvider) {
    const config = getServerConfig();
    cachedProvider = createGoogleGenerativeAI({
      apiKey: config.GOOGLE_GENERATIVE_AI_API_KEY,
    });
  }
  return cachedProvider;
}

export function getGeminiModel() {
  const config = getServerConfig();
  const provider = getGoogleProvider();
  return provider(config.GEMINI_MODEL);
}
