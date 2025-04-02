'use client'

import initTranslations from '@/app/i18n';
import TranslationProvider from '@/app/translation-provider';
import AuthorizationGuard from '@/components/authorization-guard';
import { FSLoader } from '@/components/fs-loader';
import { AgentHeader } from '@/components/layout/agent-header';
import { Header } from '@/components/layout/header';
import { OnboardingDialog } from '@/components/onboarding-dialog';
import { SaaSNotifications } from '@/components/saas-notifications';
import { AgentProvider } from '@/contexts/agent-context';
import { AttachmentProvider } from '@/contexts/attachment-context';
import { AuditContextProvider } from '@/contexts/audit-context';
import { ConfigContextProvider } from '@/contexts/config-context';
import { DatabaseContextProvider } from '@/contexts/db-context';
import { KeyContextProvider } from '@/contexts/key-context';
import { OrderProvider } from '@/contexts/order-context';
import { ProductProvider } from '@/contexts/product-context';
import { SaaSContextProvider } from '@/contexts/saas-context';
import { MemoryProvider } from '@/contexts/memory-context';
import { StatsContextProvider } from '@/contexts/stats-context';
import { TemplateProvider } from '@/contexts/template-context';
import React, { useEffect } from 'react';

const i18nNamespaces = ['translation'];

// eslint-disable-next-line @next/next/no-async-client-component
export default function GeneralAgentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string, locale: string, databaseIdHash: string };
}) {
  const [isInitializing, setIsInitializing] = React.useState(true);
  const [resources, setResources] = React.useState<any>(null);

  useEffect(() => {
    initTranslations(params.locale, i18nNamespaces).then(({ resources }) => {
      setResources(resources);
      setIsInitializing(false);
    });
  }, [params.locale, i18nNamespaces]);
  return (
    isInitializing && !resources ? <FSLoader /> :
      <TranslationProvider locale={params.locale} resources={resources} namespaces={i18nNamespaces}>
        <DatabaseContextProvider>
          <SaaSContextProvider>
            <ConfigContextProvider>
              <AuditContextProvider>
                <AuthorizationGuard>
                  <KeyContextProvider>
                    <StatsContextProvider>
                      <ProductProvider>
                        <AttachmentProvider>
                          <MemoryProvider>
                            <AgentProvider>
                              <TemplateProvider>
                                <OrderProvider>
                                  <div className={`hidden h-screen flex-col ${process.env.NEXT_PUBLIC_ENV === 'dev' ? '' : 'sm:flex xs:flex'} md:hidden text-sm p-4`}>
                                    <img src="/img/OAB-Logo-Small.svg" alt="Open Agents Builder" className="w-10 pb-4" />
                                    Mobile layout is not yet supported for the admin app. <br />Please do use tablet or desktop resolutions to acces the app. Sorry!
                                  </div>
                                  <div className={`flex h-screen flex-col ${process.env.NEXT_PUBLIC_ENV === 'dev' ? '' : 'sm:hidden xs:hidden'} md:flex`}>
                                    <Header />
                                    <AgentHeader />
                                    <SaaSNotifications />
                                    <OnboardingDialog />

                                    <div className="flex flex-1 overflow-hidden">
                                      {children}
                                    </div>
                                  </div>
                                </OrderProvider>
                              </TemplateProvider>
                            </AgentProvider>
                          </MemoryProvider>
                        </AttachmentProvider>
                      </ProductProvider>
                    </StatsContextProvider>
                  </KeyContextProvider>
                </AuthorizationGuard>
              </AuditContextProvider>
            </ConfigContextProvider>
          </SaaSContextProvider>
        </DatabaseContextProvider>
      </TranslationProvider>
  );
}