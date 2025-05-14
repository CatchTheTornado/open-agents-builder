'use client'

import { AIConsentBannerComponent } from "@/components/ai-consent-banner";
import AuthorizationGuard from "@/components/authorization-guard";
import { Chat } from "@/components/chat";
import { ChatInitForm } from "@/components/chat-init-form";
import { DisplayToolResultsMode } from "@/components/chat-messages";
import { CookieConsentBannerComponent } from "@/components/cookie-consent-banner";
import DataLoader from "@/components/data-loader";
import FeedbackWidget from "@/components/feedback-widget";
import { DatabaseContextProvider } from "@/contexts/db-context";
import { useExecContext } from "@/contexts/exec-context";
import { SaaSContextProvider } from "@/contexts/saas-context";
import { getErrorMessage } from "@/lib/utils";
import { useChat } from "ai/react";
import moment from "moment";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export default function ChatPage({children,
    params,
  }: {
    children: React.ReactNode;
    params: { id: string, databaseIdHash: string, locale: string };
  }) {
    const [isInitializing, setIsInitializing] = useState(true);
    const [generalError, setGeneralError] = useState<string | null>(null);
    const chatContext = useExecContext();
    const { t } = useTranslation();
    const { messages, append, input, handleInputChange, handleSubmit, isLoading } = useChat({
        api: "/api/chat",
      })
    
    const getSessionHeaders = () => {
        return {
            'Database-Id-Hash': chatContext.databaseIdHash,
            'Agent-Id': chatContext.agent?.id ?? '',
            'Agent-Locale': chatContext.locale,
            'Agent-Session-Id': chatContext.sessionId,
            'Current-Datetime-Iso': moment(new Date()).toISOString(true),
            'Current-Datetime': new Date().toLocaleString(),
            'Current-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
        }
    }
    
    useEffect(() => {
        chatContext.init(params.id, params.databaseIdHash, params.locale, nanoid() /** generate session id */).catch((e) => {
          console.error(e);
          setGeneralError(t(getErrorMessage(e)));
        }).then(() => {
          setIsInitializing(false);
        });
    }, [params.id, params.databaseIdHash, params.locale]);

    useEffect(() => {
        if (chatContext.agent){
          if(chatContext.initFormRequired && !chatContext.initFormDone){
            return; // wait until user fills the form
          }

          append({
            id: nanoid(),
            role: "user",
            content: t("Lets chat")
          }, {
            headers: getSessionHeaders()
          }).catch((e) => {
            toast.error(t(getErrorMessage(e)));
          });
        }
      }, [chatContext.agent, chatContext.initFormRequired, chatContext.initFormDone]);

      const authorizedChat =  (displayMode: DisplayToolResultsMode) => (
        (chatContext.initFormRequired && !chatContext.initFormDone) ? (
          <ChatInitForm
              welcomeMessage={chatContext.agent?.options?.welcomeMessage ?? ''}
            displayName={chatContext.agent?.displayName ?? ''}
          />
      ):(
          <Chat 
              headers={getSessionHeaders()} 
              welcomeMessage={chatContext.agent?.options?.welcomeMessage ?? ''}
              messages={messages}
              handleInputChange={handleInputChange}
              isLoading={isLoading}
              handleSubmit={handleSubmit}
              input={input}
              sessionId={chatContext.sessionId}
              displayName={chatContext.agent?.displayName ?? ''}
              databaseIdHash={chatContext?.databaseIdHash ?? ''}
              displayToolResultsMode={displayMode}
              
          />
      )    
    )


      return (
      <div>
        <AIConsentBannerComponent />
        <div className="pt-10">
          {isInitializing ? (
            <div className="text-center h-screen justify-center items-center flex">
              <div className="flex justify-center m-4"><DataLoader /></div>
              <div className="text-gray-500 text-center">{t("Initializing agent...")}</div>
            </div>
          ) : (
          generalError ? (
            <div className="text-center">
              <div className="flex justify-center m-4 text-red-400 text-2xl">{t('Error')}</div>
              <div className="text-red-500 text-center">{generalError}</div>
            </div>
          ): (
              chatContext.agent?.published ? (
                authorizedChat(DisplayToolResultsMode.ForEasyUser)
            ) : (
                  <DatabaseContextProvider>
                    <SaaSContextProvider>
                      <AuthorizationGuard>
                        {authorizedChat(DisplayToolResultsMode.ForUser)}
                      </AuthorizationGuard>
                    </SaaSContextProvider>
                  </DatabaseContextProvider>
            )
          )
        )}
        <FeedbackWidget />
        <CookieConsentBannerComponent />
        </div>
      </div>
    )
}