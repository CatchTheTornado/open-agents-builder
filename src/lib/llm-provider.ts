import { openai } from "@ai-sdk/openai";
import { createOllama, OllamaProvider } from "ollama-ai-provider";

enum LLMProviderType {
  OPENAI = "openai",
  OLLAMA = "ollama",
}

type LLMConfiguration = {
  provider: typeof openai | OllamaProvider;
  model: string;
  settings?: Record<string, unknown>;
};

const llmConfigurations: Record<LLMProviderType, LLMConfiguration> = {
  [LLMProviderType.OPENAI]: {
    provider: openai,
    model: process.env.LLM_MODEL || "gpt-4o",
  },
  [LLMProviderType.OLLAMA]: {
    provider: createOllama({ baseURL: process.env.OLLAMA_URL }),
    model: process.env.LLM_MODEL || "llama3.1",
    settings: { simulateStreaming: true, structuredOutputs: true },
  },
};

export function llmProviderSetup() {
  const providerType = process.env.LLM_PROVIDER as LLMProviderType;
  const configuration = llmConfigurations[providerType ?? "openai"];

  if (!configuration) {
    const supportedProviders = Object.values(LLMProviderType).join(", ");
    throw new Error(
      `Unsupported LLM provider: "${providerType}". Supported providers are: ${supportedProviders}`
    );
  }

  const { provider, model, settings } = configuration;

  return provider(model, settings);
}
