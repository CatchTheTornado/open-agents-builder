'use client';

import React from 'react';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { tool } from 'ai';

type ExecFlowToolConfiguratorProps = {
  // This tool needs no special options, but we keep the shape for consistency:
  options: Record<string, never>;
  onChange: (updated: Record<string, never>) => void;
};

export function ExecFlowToolConfigurator({ options, onChange }: ExecFlowToolConfiguratorProps) {
  const { t } = useTranslation();
  // No config needed, but here's a placeholder:
  return <p className="text-sm text-gray-600">{t('No configuration required for execFlow tool.')}</p>;
}

