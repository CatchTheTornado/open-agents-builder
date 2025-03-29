'use client';

import initTranslations from '@/app/i18n';
import TranslationProvider from '@/app/translation-provider';
import { FSLoader } from '@/components/fs-loader';
import { ThemeProvider } from '@/components/theme-provider';
import { ExecProvider } from '@/contexts/exec-context';
import React, { useEffect, useState } from 'react';

const i18nNamespaces = ['translation'];

export default function ExecLayoutClient({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { databaseIdHash: string; id: string; locale: string };
}) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [resources, setResources] = useState<any>(null);

  useEffect(() => {
    initTranslations(params.locale, i18nNamespaces).then(({ resources }) => {
      setResources(resources);
      setIsInitializing(false);
    });
  }, [params.locale]);

  return isInitializing && !resources ? (
    <FSLoader />
  ) : (
    <TranslationProvider
      locale={params.locale}
      resources={resources}
      namespaces={i18nNamespaces}
    >
      <ExecProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </ExecProvider>
    </TranslationProvider>
  );
}
