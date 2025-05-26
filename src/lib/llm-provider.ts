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

export function llmProviderSetup(selectedProvider?: string, selectedModel?: string) {
  const providerType = (selectedProvider || process.env.LLM_PROVIDER) as LLMProviderType;
  const configuration = llmConfigurations[providerType || "openai"];

  if (!configuration) {
    const supportedProviders = Object.values(LLMProviderType).join(", ");
    throw new Error(
      `Unsupported LLM provider: "${providerType}". Supported providers are: ${supportedProviders}`
    );
  }

  const { provider, settings } = configuration;
  const model = selectedModel || configuration.model;

  return provider(model, settings);
}

export function getAvailableProviders(): string[] {
  return Object.values(LLMProviderType);
}

export function getDefaultModels(provider: string): string[] {
  switch (provider) {
    case LLMProviderType.OPENAI:
      return ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"];
    case LLMProviderType.OLLAMA:
      return ["llama3.1", "gemma", "mistral"];
    default:
      return [];
  }
}
