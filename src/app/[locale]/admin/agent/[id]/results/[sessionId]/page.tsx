'use client'
import { useAgentContext } from '@/contexts/agent-context';
import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '@/lib/utils';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Result, Session } from '@/data/client/models';
import { RenderResult } from '@/components/render-result';
import { Tabs } from '@/components/ui/tabs';
import { TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs';
import { ChatMessages, DisplayToolResultsMode } from '@/components/chat-messages';
import ResultDetails from '@/components/result-details';
import { Button } from '@/components/ui/button';
import { CopyIcon, MessageCircleIcon, MoveLeftIcon, SaveIcon, WandSparkles } from 'lucide-react';
import { useCopyToClipboard } from 'react-use';
import { DatabaseContext } from '@/contexts/db-context';
import { useChat } from 'ai/react';
import { nanoid } from 'nanoid';
import { Chat } from '@/components/chat';
import { Credenza, CredenzaTrigger, CredenzaContent } from '@/components/credenza';
import { SaaSContext } from '@/contexts/saas-context';
import DataLoader from '@/components/data-loader';
import { CalendarEventsDisplayMode, SessionCalendarEvents } from '@/components/session-calendar-events';
import Calendar from '../../calendar/page';
import { agent } from 'flows-ai';


export default function SingleResultPage() {

  const dbContext = useContext(DatabaseContext);
  const [, copy] = useCopyToClipboard();
  const agentContext = useAgentContext();
  const params = useParams();

  const { t, i18n  } = useTranslation();
  const saasContext = useContext(SaaSContext);
  
  const [result, setResult] = useState<Result>();
  const [session, setSession] = useState<Session>();
  const [chatOpen, setChatOpen] = useState(false);
  const { messages, handleInputChange, isLoading, append, handleSubmit, input} = useChat({
    api: "/api/agent/results-chat",
  });
  
  useEffect(() => {
    if (agentContext.current?.id)
      agentContext.singleResult(params.sessionId as string).catch((e) => {
        toast.error(t(getErrorMessage(e)));
      }).then((result) => {
        if (result) setResult(result);
      });

      agentContext.singleSession(params.sessionId as string).catch((e) => {
        toast.error(t(getErrorMessage(e)));
      }).then((session) => {
        if (session) { 
          setSession(session);
        }
      });
  }, [agentContext.current]);

  const getSessionHeaders = () => {
    return {
      'Database-Id-Hash': dbContext?.databaseIdHash ?? '',
      'Agent-Id': agentContext.current?.id ?? '',
      'Agent-Locale': i18n.language,
      'Session-Id': result?.sessionId ?? '',
      'Current-Datetime-Iso': new Date().toISOString(),
      'Current-Datetime': new Date().toLocaleString(),
      'Current-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  }
  useEffect(() => {
    if (agentContext.current && chatOpen){
      append({
        id: nanoid(),
        role: "user",
        content: t("Lets chat")
      }, {
        headers: getSessionHeaders()
      }).catch((e) => {
        console.error(e)
        toast.error(t(getErrorMessage(e)))
      })
    }
  }, [agentContext.current, chatOpen]);



  return (
    <div className="space-y-6">
            <Button size="sm" variant="outline" onClick={() => history.back()}><MoveLeftIcon /> {t('Back')}</Button>
            <Credenza open={chatOpen} onOpenChange={setChatOpen}>
          <CredenzaContent>
            {!saasContext.saasToken || (saasContext.checkQuotas()).status === 200 ? ( 
              <Chat
                headers={getSessionHeaders()}
                welcomeMessage={t('Lets chat')}
                messages={messages}
                handleInputChange={handleInputChange}
                isLoading={isLoading}
                handleSubmit={handleSubmit}
                input={input}
                displayName={t('Modify result with chat')}
                databaseIdHash={dbContext?.databaseIdHash ?? ''}
              />
            ): <div className='text-sm text-center text-red-500 p-4'>{t('Please verify your E-mail address and AI budget to use all features of Open Agents Builder')}</div>}
          </CredenzaContent>
        </Credenza>

      <Card>
        {/* <CardHeader>
          <CardTitle>
            {new Date(result?.createdAt ?? Date.now()).toLocaleString()} {result?.userName} {result?.userEmail ? `- ${result.userEmail}` : ''}
          </CardTitle>  
        </CardHeader> */}
          { result ? (
          <CardContent className="pt-6">
            <ResultDetails 
              agent={agentContext.current}
              sessionId={result?.sessionId || ''}
              userName={result?.userName || ''}
              userEmail={result?.userEmail || ''}
              sessionStart={new Date(session?.createdAt ?? Date.now())}
              sessionEnd={new Date(result?.finalizedAt ?? Date.now())}
              messageCount={session?.messages?.length ?? 0}
              inputTokens={session?.promptTokens ?? 0} // TODO: implement inputTokens,
              outputTokens={session?.completionTokens ?? 0} // TODO: implement outputTokens,            
            />             
            <Tabs defaultValue="content" className="mt-4">
              <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="content" className="dark:data-[state=active]:bg-zinc-900 data-[state=active]:bg-zinc-100 data-[state=active]:text-gray-200 p-2 rounded-md text-sm">{t('Result')}</TabsTrigger>
                  {agentContext.current?.agentType !== 'flow' && (
                    <TabsTrigger value="chat" className="dark:data-[state=active]:bg-zinc-900 data-[state=active]:bg-zinc-100 data-[state=active]:text-gray-200 p-2 rounded-md text-sm">{t('Message history')}</TabsTrigger>
                  )}
                  <TabsTrigger value="calendar" className="dark:data-[state=active]:bg-zinc-900 data-[state=active]:bg-zinc-100 data-[state=active]:text-gray-200 p-2 rounded-md text-sm">{t('Calendar')}</TabsTrigger>
              </TabsList>
              <TabsContent value="calendar" className="p-2 text-sm">
                <SessionCalendarEvents displayMode={CalendarEventsDisplayMode.list} sessionId={result?.sessionId} />
              </TabsContent>
              <TabsContent value="content" className="p-2 text-sm">
                <RenderResult result={result} />
                <Button size="sm" variant="outline" className="mt-2" onClick={(e) => {
                  try {
                    if(result?.content) copy(result?.content)
                      toast.info(t('Copied to clipboard!'));
                  } catch (e){
                    toast.error(t(getErrorMessage(e)))
                  }
                }}>
                  <CopyIcon className="w-4 h-4" />{t('Copy')}
                </Button>              
                <Button size="sm" variant="outline" className="mt-2" onClick={(e) => {
                  if (result) agentContext.exportSingleResult(result)
                }}>
                  <SaveIcon className="w-4 h-4" />{t('Export to file')}
                </Button>
                <Button size="sm" variant="outline" className="mt-2" onClick={(e) => {
                  setChatOpen(true);
                }}>
                  <WandSparkles className="w-4 h-4" />{t('Transform with AI')}
                </Button>
              </TabsContent>
              {agentContext.current?.agentType !== 'flow' && (
                <TabsContent value="chat" className="p-2 text-sm">
                  <ChatMessages 
                        displayTimestamps={true}
                        displayToolResultsMode={DisplayToolResultsMode.AsTextMessage}
                        messages={session?.messages ?? []}
                    />
                  </TabsContent>
              )}
            </Tabs>                  
          </CardContent>
          ) : (<CardContent>
            <div className="flex justify-center items-center h-64">
              <DataLoader />
            </div></CardContent>)}
      </Card>

    </div>
  );
}