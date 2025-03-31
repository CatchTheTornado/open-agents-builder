'use client'

import { AIConsentBannerComponent } from "@/components/ai-consent-banner";
import AuthorizationGuard from "@/components/authorization-guard";
import { ChatInitForm } from "@/components/chat-init-form";
import { ChatMessageMarkdown } from "@/components/chat-message-markdown";
import { CookieConsentBannerComponent } from "@/components/cookie-consent-banner";
import DataLoader from "@/components/data-loader";
import FeedbackWidget from "@/components/feedback-widget";
import { ExecFormDisplayMode, FlowsExecForm } from "@/components/flows/flows-exec-form";
import { DatabaseContextProvider } from "@/contexts/db-context";
import { useExecContext } from "@/contexts/exec-context";
import { SaaSContextProvider } from "@/contexts/saas-context";
import { getErrorMessage } from "@/lib/utils";
import { nanoid } from "nanoid";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function ExecPage({children,
    params,
  }: {
    children: React.ReactNode;
    params: { id: string, databaseIdHash: string, locale: string };
  }) {
    const [isInitializing, setIsInitializing] = useState(true);
    const [generalError, setGeneralError] = useState<string | null>(null);
    const execContext = useExecContext();
    const { t } = useTranslation();

    const searchParams = useSearchParams();

    useEffect(() => {
      // TODO: add Exec context similar to chat context
        if (params.id && params.databaseIdHash) {
          execContext.init(params.id, params.databaseIdHash, params.locale, nanoid() /** generate session id */).catch((e) => {
            console.error(e);
            setGeneralError(t(getErrorMessage(e)));
          }).then(() => {
            setIsInitializing(false);
          });
        }
      }, [params.id, params.databaseIdHash, params.locale]);

    // useEffect(() => {
    //     if (execContext.agent){
    //     }
    //   }, [execContext.agent, execContext.initFormRequired, execContext.initFormDone]);


    const authorizedExec = (agent, agentFlow) => {
      return (

        (execContext.initFormRequired && !execContext.initFormDone) ? (
          <ChatInitForm
              welcomeMessage={execContext.agent?.options?.welcomeMessage ?? ''}
            displayName={execContext.agent?.displayName ?? ''}
          />
      ):(
        <div className="w-full max-w-2xl mx-auto">
          <div className="text-sm p-4 mb-4">
            <ChatMessageMarkdown copyToCC={false}>
              {execContext.agent?.options?.welcomeMessage ?? ''}
            </ChatMessageMarkdown>
          </div>
          {execContext.agent && execContext.agent.flows && execContext.agent.flows.length > 0  && execContext.agent.agents ? (
             <FlowsExecForm initializeExecContext={false} agent={agent} agentFlow={agentFlow} agents={execContext.agent?.agents} inputs={agentFlow?.inputs} flows={execContext.agent?.flows} databaseIdHash={params.databaseIdHash} displayMode={ExecFormDisplayMode.EndUser} />
            ) : (
            <div className="text-center">
              <div className="flex justify-center m-4 text-red-400 text-2xl">{t('Error')}</div>
              <div className="text-red-500 text-center">{t('The specified agent has no flows defined or there is an error in the flows definition. Please contact the author.')}</div>
            </div>   
          )}
        </div>
      ))
    }

    return (
      <div>
        <AIConsentBannerComponent />
        <div className="pt-10">
            {isInitializing ? (
            <div className="text-center h-screen justify-center items-center flex">
              <div className="flex justify-center m-4"><DataLoader /></div>
              <div className="text-gray-500 text-center">{t("Initializing agent...")}</div>
            </div>
            ) : generalError ? (
            <div className="text-center">
              <div className="flex justify-center m-4 text-red-400 text-2xl">{t('Error')}</div>
              <div className="text-red-500 text-center">{generalError}</div>
            </div>
            ) : (
            (() => {
              const selectedFlow =
              execContext?.agent?.flows?.find(
                (f) => f.code === (searchParams.get('flow') ?? execContext?.agent?.defaultFlow)
              ) ?? execContext?.agent?.flows?.[0]
              const content = authorizedExec(execContext.agent, selectedFlow)

              return execContext.agent?.published ? (
              content
              ) : (
              <DatabaseContextProvider>
                <SaaSContextProvider>
                <AuthorizationGuard>
                  {content}
                </AuthorizationGuard>
                </SaaSContextProvider>
              </DatabaseContextProvider>
              )
            })()
            )}
        <FeedbackWidget />
        <CookieConsentBannerComponent />
        </div>
      </div>
    )
}