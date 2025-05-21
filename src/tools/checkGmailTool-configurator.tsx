'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DatabaseContext } from '@/contexts/db-context';

type GmailToolSettings = {
  accessToken: string;
  refreshToken: string;
  expiryDate: string;
};

interface CheckGmailToolConfiguratorProps {
  options: Partial<GmailToolSettings>;
  onChange: (options: Partial<GmailToolSettings>) => void;
}

export function CheckGmailToolConfigurator({
  options,
  onChange
}: CheckGmailToolConfiguratorProps) {
  const { t } = useTranslation();
  const dbContext = React.useContext(DatabaseContext);

  const handleAuth = async () => {
    if (!dbContext?.databaseIdHash) {
      console.error('No database ID hash available');
      return;
    }

    try {
      const response = await fetch(`/api/gmail/oauth/auth-url?state=${dbContext.databaseIdHash}`);
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        console.error('Failed to get auth URL:', data.error);
      }
    } catch (error) {
      console.error('Failed to start OAuth flow:', error);
    }
  };

  if (!options.accessToken) {
    return (
      <div className="space-y-4">
        <p>{t('gmail.connectPrompt')}</p>
        <Button onClick={handleAuth}>
          {t('gmail.connectButton')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {t('gmail.accessToken')}
        </label>
        <input
          type="text"
          value={options.accessToken || ''}
          onChange={(e) => onChange({ ...options, accessToken: e.target.value })}
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {t('gmail.refreshToken')}
        </label>
        <input
          type="text"
          value={options.refreshToken || ''}
          onChange={(e) => onChange({ ...options, refreshToken: e.target.value })}
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {t('gmail.expiryDate')}
        </label>
        <input
          type="text"
          value={options.expiryDate || ''}
          onChange={(e) => onChange({ ...options, expiryDate: e.target.value })}
          className="w-full p-2 border rounded"
        />
      </div>
    </div>
  );
} 