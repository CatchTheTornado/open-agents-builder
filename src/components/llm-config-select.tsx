'use client'

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormContext, useController } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function LLMConfigSelect() {
  const { t } = useTranslation();
  const { control, watch } = useFormContext();
  const [providers, setProviders] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);

  // Use useController for form integration
  const {
    field: { onChange: onProviderChange, value: providerValue },
    fieldState: { error: providerError },
  } = useController({
    name: 'llmProvider',
    control,
  });

  const {
    field: { onChange: onModelChange, value: modelValue },
    fieldState: { error: modelError },
  } = useController({
    name: 'llmModel',
    control,
  });

  // Fetch available providers on mount
  useEffect(() => {
    async function fetchProviders() {
      try {
        const response = await fetch('/api/llm/providers');
        if (response.ok) {
          const data = await response.json();
          setProviders(data.providers || []);
        } else {
          console.error('Failed to fetch LLM providers');
        }
      } catch (error) {
        console.error('Error fetching LLM providers:', error);
      } finally {
        setLoadingProviders(false);
      }
    }
    
    fetchProviders();
  }, []);

  // Fetch models when provider changes
  useEffect(() => {
    async function fetchModels(provider: string) {
      if (!provider) {
        setModels([]);
        return;
      }

      setLoadingModels(true);
      try {
        const response = await fetch(`/api/llm/models?provider=${encodeURIComponent(provider)}`);
        if (response.ok) {
          const data = await response.json();
          setModels(data.models || []);
        } else {
          console.error('Failed to fetch LLM models');
          setModels([]);
        }
      } catch (error) {
        console.error('Error fetching LLM models:', error);
        setModels([]);
      } finally {
        setLoadingModels(false);
      }
    }

    if (providerValue) {
      fetchModels(providerValue);
      // Clear model selection when provider changes if it's a new provider
      if (modelValue && !models.includes(modelValue)) {
        onModelChange('');
      }
    }
  }, [providerValue, onModelChange, modelValue, models]);

  const handleProviderChange = (provider: string) => {
    onProviderChange(provider);
    // Clear model selection when provider changes
    onModelChange('');
  };

  const handleModelChange = (model: string) => {
    onModelChange(model);
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="llmProvider" className="block text-sm font-medium">
          {t('LLM Provider')}
        </label>
        <Select 
          value={providerValue || ''} 
          onValueChange={handleProviderChange}
          disabled={loadingProviders}
        >
          <SelectTrigger className="mt-1">
            <SelectValue 
              placeholder={loadingProviders ? t('Loading providers...') : t('Select a provider')} 
            />
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
          {t('LLM Model')}
        </label>
        <Select 
          value={modelValue || ''} 
          onValueChange={handleModelChange}
          disabled={!providerValue || loadingModels}
        >
          <SelectTrigger className="mt-1">
            <SelectValue 
              placeholder={
                !providerValue 
                  ? t('Select a provider first') 
                  : loadingModels 
                    ? t('Loading models...') 
                    : t('Select a model')
              } 
            />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {modelError && (
          <p className="text-red-500 text-sm mt-1">{modelError.message}</p>
        )}
      </div>
    </div>
  );
}
