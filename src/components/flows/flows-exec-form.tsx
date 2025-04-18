// flows-exec-form.tsx

import React, { useContext, useEffect, useRef, useState } from "react";
import { Agent, AgentFlow } from "@/data/client/models";
import { AgentDefinition, FlowChunkEvent, FlowInputVariable } from "@/flows/models";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AgentApiClient } from "@/data/client/agent-api-client";
import { DatabaseContext } from "@/contexts/db-context";
import { SaaSContext } from "@/contexts/saas-context";
import { AxiosError } from "axios";
import { safeJsonParse } from "@/lib/utils";
import DataLoader from "../data-loader";
import { DataLoaderIcon } from "../data-loader-icon";
import { nanoid } from "nanoid";
import moment from "moment";
import { useExecContext } from "@/contexts/exec-context";
import { FlowInputValuesFiller } from "./flows-input-filler";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChatMessageMarkdown } from "../chat-message-markdown";
import { Code2Icon, FileIcon, PlayIcon } from "lucide-react";
import { FlowsEndUserUI, EndUserUIHandle } from "./flows-end-user-ui";
import { FlowsDebugLog, DebugLogHandle } from "./flows-debug-log";
import { FlowChunkType } from "@/flows/models";
import { set } from "date-fns";

export enum ExecFormDisplayMode {
  EndUser = "enduser",
  Admin = "admin",
}

interface Props {
  agent: Agent | undefined;
  agentFlow: AgentFlow | undefined;
  flows: AgentFlow[];
  initializeExecContext: boolean;
  agents: AgentDefinition[];
  databaseIdHash: string;
  displayMode: ExecFormDisplayMode;
  onVariablesChanged?: (vars: Record<string, any> | string) => void;
  children?: React.ReactNode;
}

export function FlowsExecForm({
  agent,
  agentFlow,
  flows,
  initializeExecContext,
  agents,
  databaseIdHash,
  displayMode,
  onVariablesChanged,
  children
}: Props) {
  const [sessionId, setSessionId] = useState<string>(nanoid());
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  const [isInitializing, setIsInitializing] = useState<boolean>(
    initializeExecContext
  );
  const [flowResult, setFlowResult] = useState<any | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const dbContext = useContext(DatabaseContext);
  const saasContext = useContext(SaaSContext);
  const { t, i18n } = useTranslation();
  const [requestParams, setRequestParams] =
    useState<Record<string, any> | string>();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [executionInProgress, setExecutionInProgress] = useState<boolean>(false);

  const execContext = useExecContext();
  const timeRef = useRef<any>(null);

  // Refs do sub-komponentów
  const endUserUIRef = useRef<EndUserUIHandle>(null);
  const debugLogRef = useRef<DebugLogHandle>(null);


  const [currentTabs, setCurrentTabs] = useState<string[]>([]);  
  const [flowUiState, setFlowUiState] = useState<Record<string, any>>();


  useEffect(() => {
    if (initializeExecContext) {
      execContext
        .init(agent?.id, databaseIdHash, i18n.language, nanoid())
        .catch((e) => {
          console.error(e);
          setGeneralError(t(e.message || "Error"));
        })
        .then(() => {
          setIsInitializing(false);
        });
    }
  }, [initializeExecContext, databaseIdHash, i18n.language]);

  function getSessionHeaders() {
    return {
      "Database-Id-Hash": execContext.databaseIdHash,
      "Agent-Id": execContext.agent?.id ?? "",
      "Agent-Locale": execContext.locale,
      "Agent-Session-Id": execContext.sessionId,
      "Current-Datetime-Iso": moment(new Date()).toISOString(true),
      "Current-Datetime": new Date().toLocaleString(),
      "Current-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
  //const flow = agentFlow; //flows.find((f) => f.code === agentFlow?.code);

  async function handleExecute(newFlowUiState: Record<string, any> | null = null) {
    if (!agentFlow) {
      toast.error(t("Flow is not defined"));
      return;
    }

    setFlowResult(null);
    // Walidacja inputów
    const requiredFields =
    agentFlow?.inputs?.filter((input) => input.required).map((input) => input.name) ??
      [];
    if (requestParams && typeof requestParams === "object") {
      const missingFields = requiredFields.filter((field) => !requestParams[field]);
      if (missingFields.length > 0) {
        toast.error(
          t("Please fill in all required fields: ") + missingFields.join(", ")
        );
        setExecError(
          t("Please fill in all required fields: ") + missingFields.join(", ")
        );
        return;
      }
    } else if (!requestParams && requiredFields.length > 0) {
      toast.error(
        t("Please fill in all required fields: ") + requiredFields.join(", ")
      );
      setExecError(
        t("Please fill in all required fields: ") + requiredFields.join(", ")
      );
      return;
    }

    setTimeElapsed(0);
    setExecError("");
    setFlowResult(null);
    setExecutionInProgress(true);

    if(!newFlowUiState ) setFlowUiState({});

    if (newFlowUiState === null) {
        if (displayMode === ExecFormDisplayMode.EndUser)
            endUserUIRef.current?.clear(); 
        else 
            debugLogRef.current?.clear();    
    }

    try {
      const apiClient = new AgentApiClient("", dbContext, saasContext);

      timeRef.current = setInterval(() => {
        setTimeElapsed((prv) => prv + 1);
      }, 1000);

      const stream = await apiClient.execStream(
        agent?.id || "",
        agentFlow.code,
        newFlowUiState ??  {},
        requestParams,
        "sync",
        getSessionHeaders()
      );

      setCurrentTabs(['result', 'trace']);

      for await (const chunk of stream) {


        if([FlowChunkType.UIComponent].includes(chunk.type)) {
            setFlowUiState(prevState => {
                return {
                    ...prevState,
                    [chunk.component]: chunk.componentProps                        
                }});
        }


        // Przekazujemy chunk do EndUserUI i DebugLog
        if (displayMode === ExecFormDisplayMode.EndUser)
            endUserUIRef.current?.handleChunk(chunk); 
        else 
            debugLogRef.current?.handleChunk(chunk);

        // Obsługa finalResult / error na wysokim poziomie
        if (chunk.type === "finalResult") {
          setFlowResult(chunk.result);
        }
        if (chunk.type === "error") {
          setExecError(chunk.message);
        }
      }
    } catch (e) {
      console.error(e);
      let respData = "";
      if (e instanceof AxiosError) {
        respData = (e.response?.data as string) ?? t("An error occurred");
      }
      setFlowResult(safeJsonParse(respData, respData));
      setExecError(t("Failed to execute flow: ") + (e as Error).message);
    } finally {
      clearInterval(timeRef.current);
      setExecutionInProgress(false);
    }
  }

  return (
    <div>
      {isInitializing ? (
        <div className="text-center">
          <div className="flex justify-center m-4">
            <DataLoader />
          </div>
          <div className="text-gray-500 text-center">
            {t("Initializing runtime environment...")}
          </div>
        </div>
      ) : generalError ? (
        <div className="text-center">
          <div className="flex justify-center m-4 text-red-400 text-2xl">
            {t("Error")}
          </div>
          <div className="text-red-500 text-center">{generalError}</div>
        </div>
      ) : (
        <div>
          <div className="mb-2">
            <FlowInputValuesFiller
              variables={agentFlow?.inputs ?? []}
              onChange={(values) => {
                setRequestParams(values);
                if (onVariablesChanged) {
                  onVariablesChanged(values);
                }
              }}
            />
          </div>
          {execError && (
            <div className="text-red-500 text-sm p-3"><ChatMessageMarkdown>{execError}</ChatMessageMarkdown></div>
          )}
          <div className="flex">
            {executionInProgress && <DataLoaderIcon />}
            <Button
              className={executionInProgress ? "ml-2" : ""}
              disabled={executionInProgress || (children !== null && children !== undefined)}
              variant={"secondary"}
              size="sm"
              onClick={(e) => handleExecute (null)}
            >
              <PlayIcon className="w-4 h-4" />
              {t("Execute")}
            </Button>

            {children}

            <div className="ml-2 text-xs h-8 items-center flex">
              {t("Session Id: ")} {execContext.sessionId}
              {executionInProgress && (
                <div className="ml-2 text-xs flex ">
                  {t(` - executing flow (${timeElapsed} seconds)... `)}
                </div>
              )}
            </div>
          </div>

          {/* 
            W zależności od displayMode, pokazujemy EndUserUI lub Admin UI (z DebugLog).
          */}
          {displayMode === ExecFormDisplayMode.EndUser && (
            <div>
              <FlowsEndUserUI
                ref={endUserUIRef}
                displayChunkTypes={[
                  FlowChunkType.Error,
                  FlowChunkType.FlowStart,
                  FlowChunkType.FinalResult,                    
                  FlowChunkType.Generation,
                  FlowChunkType.ToolCalls,
                  FlowChunkType.TextStream,
                  FlowChunkType.UIComponent,
                ]}
                onSendUserAction={(data) => {
                  console.log("EndUserUI user action:", data);
                  const newState = {...flowUiState, ...data};
                  setFlowUiState(newState);
                  handleExecute(newState);
                }}
              />
              {/* {flowResult && (
                typeof flowResult === "string" ? (
                  <ChatMessageMarkdown>{flowResult}</ChatMessageMarkdown>
                ) : (
                  <pre className="bg-gray-100 p-2 rounded text-xs mt-2">
                    {JSON.stringify(flowResult, null, 2)}
                  </pre>
                )
              )} */}
            </div>
          )}

          {displayMode === ExecFormDisplayMode.Admin && (
            <div className="mt-4">
              <Accordion value={currentTabs} onValueChange={(value) => setCurrentTabs(value)} type="multiple" className="w-full">
                {flowResult && (
                  <AccordionItem value={"result"} className="mb-2 border p-2">
                    <AccordionTrigger className="flex align-left justify-left text-md font-bold">
                      <div className="flex">
                        <FileIcon className="w-6 h-6 mr-2" /> {t("Result")}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {typeof flowResult === "string" ? (
                        <ChatMessageMarkdown>{flowResult}</ChatMessageMarkdown>
                      ) : (
                        <pre className="bg-gray-100 p-2 rounded text-xs">
                          {JSON.stringify(flowResult, null, 2)}
                        </pre>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}
                <AccordionItem value={"trace"} className="border p-2">
                  <AccordionTrigger className="flex items-left justify-left font-bold">
                    <div className="flex">
                      <Code2Icon className="w-6 h-6 mr-2" />
                      <span>{t("Trace")}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <FlowsDebugLog
                      ref={debugLogRef}
                      displayChunkTypes={[
                        FlowChunkType.FlowStart,
                        FlowChunkType.FlowStepStart,
                        FlowChunkType.Generation,
                        FlowChunkType.Error,
                        FlowChunkType.Message,
//                        FlowChunkType.FinalResult,
                        FlowChunkType.ToolCalls,
                        FlowChunkType.TextStream,
                        FlowChunkType.UIComponent,
                      ]}
                      onSendUserAction={(data) => {
                        console.log("EndUserUI user action:", data);
                        const newState = {...flowUiState, ...data};
                        setFlowUiState(newState);
                        handleExecute(newState);
                      }}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
