'use client'
import { useAgentContext } from '@/contexts/agent-context';
import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '@/lib/utils';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Session } from '@/data/client/models';
import { ChatMessages, DisplayToolResultsMode } from '@/components/chat-messages';
import { Button } from '@/components/ui/button';
import { MoveLeftIcon } from 'lucide-react';
import { useCopyToClipboard } from 'react-use';
import { DatabaseContext } from '@/contexts/db-context';
import { RenderSession } from '@/components/render-session';
import { SessionHeader } from '@/components/session-header';
import DataLoader from '@/components/data-loader';
import { CalendarEventsDisplayMode, SessionCalendarEvents } from '@/components/session-calendar-events';


export default function SingleResultPage() {

  const dbContext = useContext(DatabaseContext);
  const [, copy] = useCopyToClipboard();
  const agentContext = useAgentContext();
  const params = useParams();

  const { t, i18n  } = useTranslation();

  const [session, setSession] = useState<Session>();

  useEffect(() => {
    if (agentContext.current?.id)
      agentContext.singleSession(params.sessionId as string).catch((e) => {
        toast.error(t(getErrorMessage(e)));
      }).then((session) => {
        if (session) { 
          setSession(session);
        }
      });
  }, [agentContext.current]);



  return (
    <div className="space-y-6">
      <Button size="sm" variant="outline" onClick={() => history.back()}><MoveLeftIcon /> {t('Back')}</Button>
      <Card>
        {session ? (
          <CardContent className="p-6">
                <SessionHeader session={session} />
                <RenderSession session={session} />
                <SessionCalendarEvents displayMode={CalendarEventsDisplayMode.list} sessionId={session.id} />
                <div className="p-4">
                  <ChatMessages 
                        databaseIdHash={dbContext?.databaseIdHash ?? ''}
                        sessionId={session.id}
                        displayTimestamps={true}
                        displayToolResultsMode={DisplayToolResultsMode.AsTextMessage}
                        messages={session?.messages ?? []}
                    />
                </div>
          </CardContent>
        ) : (<CardContent>
          <div className="flex justify-center items-center h-64">
            <DataLoader />
          </div>
        </CardContent>)}
      </Card>

    </div>
  );
}