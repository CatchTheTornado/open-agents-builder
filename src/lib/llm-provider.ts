import { openai } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider";

enum LLMProviderType {
  OPENAI = "openai",
  OLLAMA = "ollama",
}

type LLMConfiguration = {
  factory: typeof openai | typeof createOllama;
  model: string;
  settings?: Record<string, unknown>;
};

const llmConfigurations: Record<LLMProviderType, LLMConfiguration> = {
  [LLMProviderType.OPENAI]: {
    factory: openai,
    model: process.env.LLM_MODEL || "gpt-4o",
  },
  [LLMProviderType.OLLAMA]: {
    factory: createOllama,
    model: process.env.LLM_MODEL || "llama3.1",
    settings: { simulateStreaming: true, structuredOutputs: true },
  },
};

export function llmProviderSetup() {
  const providerType = process.env.LLM_PROVIDER as LLMProviderType;
  const configuration = llmConfigurations[providerType];

  if (!configuration) {
    const supportedProviders = Object.values(LLMProviderType).join(", ");
    throw new Error(
      `Unsupported LLM provider: "${providerType}". Supported providers are: ${supportedProviders}`
    );
  }

  const { factory, model, settings } = configuration;

  return factory(model, settings);
}
