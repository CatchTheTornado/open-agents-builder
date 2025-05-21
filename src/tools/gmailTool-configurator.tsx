'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAgentContext } from '@/contexts/agent-context';
import { DatabaseContext } from '@/contexts/db-context';

interface GmailToolSettings {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  databaseIdHash: string;
  agentId: string;
}

interface GmailToolConfiguratorProps {
  options: Partial<GmailToolSettings>;
  onChange: (options: Partial<GmailToolSettings>) => void;
}

export function GmailToolConfigurator({
  options,
  onChange
}: GmailToolConfiguratorProps) {
  const { t } = useTranslation();
  const dbContext = React.useContext(DatabaseContext);
  const agentContext = useAgentContext();
  
  const handleAuth = async () => {
    if (!dbContext?.databaseIdHash || !agentContext.current?.id) {
      console.error('No database ID hash or agent ID available');
      return;
    }
    try {
      const response = await fetch(`/api/gmail/oauth/auth-url?state=${dbContext.databaseIdHash}&agentId=${agentContext.current.id}`);

      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }

      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to start Gmail auth:', error);
    }
  };

  if (!options.accessToken) {
    return (
      <div className="space-y-4">
        <p>{t('Connect your Gmail account to enable email functionality')}</p>
        <Button onClick={handleAuth}>
          {t('Connect Gmail')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          {t('Access Token')}
        </label>
        <input
          type="text"
          value={options.accessToken || ''}
          onChange={(e) => onChange({ ...options, accessToken: e.target.value })}
          className="w-full p-2 border rounded"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          {t('Refresh Token')}
        </label>
        <input
          type="text"
          value={options.refreshToken || ''}
          onChange={(e) => onChange({ ...options, refreshToken: e.target.value })}
          className="w-full p-2 border rounded"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          {t('Expiry Date')}
        </label>
        <input
          type="number"
          value={options.expiryDate || ''}
          onChange={(e) => onChange({ ...options, expiryDate: e.target.value ? parseInt(e.target.value) : 0 })}
          className="w-full p-2 border rounded"
        />
      </div>
    </div>
  );
} 