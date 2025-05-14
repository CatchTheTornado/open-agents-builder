'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAgentContext } from '@/contexts/agent-context';
import { useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Credenza, CredenzaContent, CredenzaTrigger } from '@/components/credenza';
import { Button } from '@/components/ui/button';
import { useChat } from 'ai/react';
import { nanoid } from 'nanoid';
import { DatabaseContext } from '@/contexts/db-context';
import {  FolderOpenIcon, Loader2, Mail, MessageCircleIcon, Share2Icon, ShareIcon } from 'lucide-react';
import InfiniteScroll from '@/components/infinite-scroll';
import { getErrorMessage } from '@/lib/utils';
import { toast } from 'sonner';
import { Chat } from '@/components/chat';
import { NoRecordsAlert } from '@/components/shared/no-records-alert';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RenderResult } from '@/components/render-result';
import { Input } from '@/components/ui/input';
import { useDebounce } from "use-debounce";
import { SaaSContext } from '@/contexts/saas-context';
import { useCopyToClipboard } from 'react-use';
import { ResultDeleteDialog } from '@/components/result-delete-dialog';
import { SessionHeader } from '@/components/session-header';
import { SessionMessagesDialog } from '@/components/session-messages-dialog';
import { DisplayToolResultsMode } from '@/components/chat-messages';
import { CalendarEventsDisplayMode, SessionCalendarEvents } from '@/components/session-calendar-events';
import { SessionFiles, SessionFilesDisplayMode } from '@/components/session-files';


export default function ResultsPage() {
  const agentContext = useAgentContext();
  const dbContext = useContext(DatabaseContext);
  const { t, i18n  } = useTranslation();
  const router = useRouter();

  const [hasMore, setHasMore] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsQuery, setResultsQuery] = useState({
    limit: 4,
    offset: 0,
    orderBy: 'createdAt',
    query: ''
  });
  const [debouncedSearchQuery] = useDebounce(resultsQuery, 500);

  const [pageSize, setPageSize] = useState(4);

  const [sessionId, setSessionId] = useState<string | null>(null)
  const { messages, handleInputChange, isLoading, append, handleSubmit, input} = useChat({
    api: "/api/agent/results-chat",
  });
  const [isResultsChatOpen, setResultsChatOpen] = useState(false);
  const [, copy] = useCopyToClipboard();

  const saasContext = useContext(SaaSContext);
  
  const getSessionHeaders = () => {
    return {
      'Database-Id-Hash': dbContext?.databaseIdHash ?? '',
      'Agent-Id': agentContext.current?.id ?? '',
      'Agent-Locale': i18n.language,
      'Session-Id': sessionId ?? '',
      'Current-Datetime-Iso': new Date().toISOString(),
      'Current-Datetime': new Date().toLocaleString(),
      'Current-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  }
  useEffect(() => {
    if (agentContext.current && isResultsChatOpen){
      setSessionId(nanoid())
      if (messages.length === 0) {
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
    }
  }, [agentContext.current, isResultsChatOpen]);

  useEffect(() => {
    if (agentContext.current?.id)
      agentContext.agentResults(agentContext.current.id, debouncedSearchQuery).catch((e) => {
        toast.error(t(getErrorMessage(e)));
      });

  }, [debouncedSearchQuery, agentContext.current]);

  useEffect(() => {
    setHasMore(agentContext.results.total > agentContext.results.offset);
    setResultsLoading(false);
  }, [agentContext.results]);

  return (
    <div className="space-y-6">


      { agentContext.results.rows.length > 0 ? (
        <div className="flex space-x-2">
        <Credenza open={isResultsChatOpen} onOpenChange={setResultsChatOpen}>
          <CredenzaTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => setResultsChatOpen(true)}><MessageCircleIcon /> {t('Chat about results ...')}</Button>
          </CredenzaTrigger>
          <CredenzaContent className="max-w-3xl">
            {saasContext.saasToken && (saasContext.checkQuotas()).status === 200 ? ( 
              <Chat
                headers={getSessionHeaders()}
                welcomeMessage={t("By using this chat you may **ask** some cool questions or **modify** the results and your schedule:\n\n- **What's my schedule for Tomorrow**?\n\n- **Please move the meeting from 9:00 to 11:00**\n\n- **What is the most frequently requested service**?\n\n- **How many meetings do I have on average per day this week?**")}
                messages={messages}
                handleInputChange={handleInputChange}
                isLoading={isLoading}
                handleSubmit={handleSubmit}
                input={input}
                displayName={t('Chat with results')}
                databaseIdHash={dbContext?.databaseIdHash ?? ''}
                displayToolResultsMode={DisplayToolResultsMode.ForUser}
                sessionId={sessionId ?? ''}
                agentId={agentContext.current?.id ?? ''}
              />
            ): <div className='text-sm text-center text-red-500 p-4'>{t('Please verify your E-mail address and AI budget to use all features of Open Agents Builder')}</div>}
          </CredenzaContent>
        </Credenza>
        <Button size="sm" variant="outline" onClick={() => {
          try {
            if (agentContext.current) {
              agentContext.exportResults(agentContext.current);
              toast.info(t('Exported results'))
            } else {
              toast.error(t('No agent selected, unable to export results'))
            }
          } catch (e) {
            console.error(e);
            toast.error(t(getErrorMessage(e)));
          }
        }}><ShareIcon className='w-4 h-4' /> {t('Export results ...')}</Button>
        </div>
      ): null}
      <Input placeholder={t('Search results ...')} onChange={(e) => {
        setResultsQuery({...resultsQuery, query: e.target.value})
      }}  value={resultsQuery.query}/>
      {agentContext.results.rows.length === 0 ? (
        <NoRecordsAlert title={t('No results yet!')}>
          {t('No results saved for this agent yet! Please send the agent link to get the results flow started!')}
        </NoRecordsAlert>
      ): null}
      {agentContext.results.rows.map((result) => (
        <Card key={result.sessionId}>
          <CardHeader>
            <CardTitle>
            <Button className="ml-auto right-20 mr-2" size={"sm"} variant="secondary" onClick={() => {
              router.push(`/admin/agent/${result.agentId}/results/${result.sessionId}`);
            }}>
              <FolderOpenIcon className="w-4 h-4" />
            </Button>

            {agentContext.current?.agentType !== 'flow' && (
              <SessionMessagesDialog sessionId={result.sessionId} displayToolResultsMode={DisplayToolResultsMode.AsTextMessage} />
            )}


            <Button className="ml-auto right-20 mr-2" size={"sm"} variant="secondary" onClick={() => {
              copy(process.env.NEXT_PUBLIC_APP_URL + `/admin/agent/${result.agentId}/results/${result.sessionId}`)
              toast.info(t('Link copied to clipboard!'))
            }}>
              <Share2Icon className="w-4 h-4" />
            </Button>            

          </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <SessionHeader session={result} />
            <RenderResult result={result} />
            <SessionFiles sessionId={result.sessionId} displayMode={SessionFilesDisplayMode.list} />
            <SessionCalendarEvents displayMode={CalendarEventsDisplayMode.icon} sessionId={result.sessionId} />
            <div className="pt-4 flex justify-end">
              <ResultDeleteDialog result={result} />
            </div>
          </CardContent>
        </Card>
      ))}
       <InfiniteScroll hasMore={hasMore} isLoading={resultsLoading} next={() => {
        if ((resultsQuery.offset + resultsQuery.limit) < agentContext.results.total) {
          const expandedQr = { ...resultsQuery, limit: resultsQuery.limit + pageSize };
          setResultsQuery(expandedQr);
          setResultsLoading(true);
          setHasMore(true);
        } else {
          setHasMore(false);
        }
          
       }} threshold={1}>
          {hasMore && <Loader2 className="my-4 h-8 w-8 animate-spin" />}
        </InfiniteScroll>      
    </div>
  );
}