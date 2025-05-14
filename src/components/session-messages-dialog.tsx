import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { MessageCircleIcon } from "lucide-react";
import { ChatMessages, DisplayToolResultsMode } from "./chat-messages";
import { Message } from "ai";
import { useContext, useEffect, useState } from "react";
import { Button } from "./ui/button";
import DataLoader from "./data-loader";
import { SessionApiClient } from "@/data/client/session-api-client";
import { DatabaseContext } from "@/contexts/db-context";
import { SaaSContext } from "@/contexts/saas-context";
import { Session } from "@/data/client/models";
import { getErrorMap } from "zod";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "./ui/scroll-area";
import { SessionHeader } from "./session-header";

export function SessionMessagesDialog({ sessionId, displayToolResultsMode }: { sessionId:string, displayToolResultsMode: DisplayToolResultsMode }) {

  const [messages, setMesssages] = useState([] as Message[]); 
  const [session, setSession] = useState<Session | null>(null);
  const dbContext = useContext(DatabaseContext);
  const saasContext = useContext(SaaSContext);
  const { t } = useTranslation();


  useEffect(() => {
    
    const client = new SessionApiClient('', dbContext, saasContext);
    client.get(sessionId).then((sessions) => {
        if (sessions.length > 0) {
            const session = Session.fromDTO(sessions[0]);
            setSession(session);
            if (session.messages) setMesssages(session.messages);
        }
    }).catch((e) => {
        console.error(e);
        toast.error(t(getErrorMessage(e)))
    });
    

  }, [sessionId]);


  return (<Dialog>
    <DialogTrigger asChild>
      <Button className="ml-auto right-20 mr-2" size={"sm"} variant="secondary">
        <MessageCircleIcon className="w-4 h-4" />
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-3xl">
      <ScrollArea className="h-[80vh] pr-4">
        <SessionHeader session={session ?? {}} />

        {messages ? (
          <ChatMessages             
            databaseIdHash={dbContext?.databaseIdHash ?? ''}
            displayToolResultsMode={displayToolResultsMode}
            displayTimestamps={true}
            messages={messages}
            sessionId={sessionId}
          />
        ) : <div className="flex justify-center items-center h-64"><DataLoader /></div>}
      </ScrollArea>
    </DialogContent>
  </Dialog>);
}