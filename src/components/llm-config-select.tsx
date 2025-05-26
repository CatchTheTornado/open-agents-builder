'use client'

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormContext, useController } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAvailableProviders, getDefaultModels } from '@/lib/llm-provider';

export function LLMConfigSelect() {
  const { t } = useTranslation();
  const { control } = useFormContext();
  const [models, setModels] = useState<string[]>([]);

  // Get static providers directly
  const providers = getAvailableProviders();

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

  // Update models when provider changes
  useEffect(() => {
    if (providerValue) {
      const availableModels = getDefaultModels(providerValue);
      setModels(availableModels);
      // Clear model selection if current model is not available for new provider
      if (modelValue && !availableModels.includes(modelValue)) {
        onModelChange('');
      }
    } else {
      setModels([]);
    }
  }, [providerValue, modelValue, onModelChange]);

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
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={t('Select a provider')} />
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
          disabled={!providerValue}
        >
          <SelectTrigger className="mt-1">
            <SelectValue 
              placeholder={
                !providerValue 
                  ? t('Select a provider first') 
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
