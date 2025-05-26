"use client";

import React from "react";
import { useEffect, useState, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useFormContext, useController } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAvailableProviders } from "@/lib/llm-provider";
import { DatabaseContext } from "@/contexts/db-context";
import { SaaSContext } from "@/contexts/saas-context";

// Direct call to Ollama (local, no auth needed)
const fetchOllamaModels = async (): Promise<string[]> => {
  try {
    const ollamaUrl =
      process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434";
    const response = await fetch(`${ollamaUrl}/api/tags`);

    if (response.ok) {
      const data = (await response.json()) as { models: { name: string }[] };
      return data.models.map((model) => model.name);
    }
  } catch (error) {
    console.error("Error fetching Ollama models:", error);
  }

  // Fallback to default models
  return ["llama3.1", "gemma", "mistral"];
};

// Authenticated call to OpenAI models API
const fetchOpenAIModels = async (
  dbContext: any,
  saasContext: any
): Promise<string[]> => {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add authentication headers (following AdminApiClient pattern)
    if (dbContext?.accessToken) {
      headers["Authorization"] = `Bearer ${dbContext.accessToken}`;
    }

    if (dbContext?.databaseIdHash) {
      headers["Database-Id-Hash"] = dbContext.databaseIdHash;
    }

    if (saasContext?.saasToken) {
      headers["SaaS-Token"] = saasContext.saasToken;
    }

    const response = await fetch("/api/llm/openai-models", {
      method: "GET",
      headers,
    });

    if (response.ok) {
      const data = await response.json();
      return data.models || [];
    } else {
      console.error("Failed to fetch OpenAI models:", response.status);
    }
  } catch (error) {
    console.error("Error fetching OpenAI models:", error);
  }

  // Fallback to default models
  return ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"];
};

export function LLMConfigSelect() {
  const { t } = useTranslation();
  const { control } = useFormContext();
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Get authentication contexts
  const dbContext = useContext(DatabaseContext);
  const saasContext = useContext(SaaSContext);

  // Get static providers directly
  const providers = getAvailableProviders();

  // Use useController for form integration
  const {
    field: { onChange: onProviderChange, value: providerValue },
    fieldState: { error: providerError },
  } = useController({
    name: "llmProvider",
    control,
  });

  const {
    field: { onChange: onModelChange, value: modelValue },
    fieldState: { error: modelError },
  } = useController({
    name: "llmModel",
    control,
  });

  // Fetch models when provider changes
  useEffect(() => {
    async function fetchModels(provider: string) {
      if (!provider) {
        setModels([]);
        return;
      }

      setLoadingModels(true);
      try {
        console.log("Fetching models for provider:", provider);

        let fetchedModels: string[] = [];
        if (provider === "openai") {
          fetchedModels = await fetchOpenAIModels(dbContext, saasContext);
        } else if (provider === "ollama") {
          fetchedModels = await fetchOllamaModels();
        }

        console.log("Models fetched:", fetchedModels);
        setModels(fetchedModels);
      } catch (error) {
        console.error("Error fetching models:", error);
        setModels([]);
      } finally {
        setLoadingModels(false);
      }
    }

    if (providerValue) {
      fetchModels(providerValue);
      // Clear model selection when provider changes
      onModelChange("");
    } else {
      setModels([]);
    }
  }, [providerValue, onModelChange, dbContext, saasContext]);

  const handleProviderChange = (provider: string) => {
    onProviderChange(provider);
  };

  const handleModelChange = (model: string) => {
    onModelChange(model);
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="llmProvider" className="block text-sm font-medium">
          {t("LLM Provider")}
        </label>
        <Select
          value={providerValue || ""}
          onValueChange={handleProviderChange}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={t("Select a provider")} />
          </SelectTrigger>
          <SelectContent>
            {providers.map((provider) => (
              <SelectItem key={provider} value={provider}>
                {provider.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {providerError && (
          <p className="text-red-500 text-sm mt-1">{providerError.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="llmModel" className="block text-sm font-medium">
          {t("LLM Model")}
        </label>
        <Select
          value={modelValue || ""}
          onValueChange={handleModelChange}
          disabled={!providerValue || loadingModels}
        >
          <SelectTrigger className="mt-1">
            <SelectValue
              placeholder={
                !providerValue
                  ? t("Select a provider first")
                  : loadingModels
                    ? t("Loading models...")
                    : models.length === 0
                      ? "No models available"
                      : t("Select a model")
              }
            />
          </SelectTrigger>
          <SelectContent>
            {loadingModels ? (
              <SelectItem value="Loading models..." disabled>
                {t("Loading models...")}
              </SelectItem>
            ) : models.length === 0 ? (
              <SelectItem value="No models available" disabled>
                No models available
              </SelectItem>
            ) : (
              models.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {modelError && (
          <p className="text-red-500 text-sm mt-1">{modelError.message}</p>
        )}
      </div>
    </div>
  );
}
