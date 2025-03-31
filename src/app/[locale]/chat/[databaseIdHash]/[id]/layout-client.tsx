'use client';

import initTranslations from '@/app/i18n';
import TranslationProvider from '@/app/translation-provider';
import { FSLoader } from '@/components/fs-loader';
import { ThemeProvider } from '@/components/theme-provider';
import { ExecProvider } from '@/contexts/exec-context';
import React, { useEffect, useState } from 'react';

// tu możesz w razie potrzeby dopisać typ:
export default function ChatLayoutClient({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string; databaseIdHash: string; locale: string };
}) {
  const i18nNamespaces = ['translation'];

  const [isInitializing, setIsInitializing] = useState(true);
  const [resources, setResources] = useState<any>(null);

  useEffect(() => {
    initTranslations(params.locale, i18nNamespaces).then(({ resources }) => {
      setResources(resources);
      setIsInitializing(false);
    });
  }, [params.locale]); // i18nNamespaces jest stałe, więc raczej nie musisz go do deps

  return isInitializing && !resources ? (
    <FSLoader />
  ) : (
    <TranslationProvider locale={params.locale} resources={resources} namespaces={i18nNamespaces}>
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
