import { Agent, ToolConfiguration } from '@/data/client/models';
import { AgentDTO, SessionDTO, StatDTO } from '@/data/dto';
import ServerAgentRepository from '@/data/server/server-agent-repository';
import ServerSessionRepository from '@/data/server/server-session-repository';
import ServerStatRepository from '@/data/server/server-stat-repository';
import { AuthorizedSaaSContext, authorizeSaasContext } from '@/lib/generic-api';
import { renderPrompt } from '@/lib/templates';
import { CoreMessage, ImagePart, Message, TextPart, Tool, convertToCoreMessages, streamText, tool } from 'ai';
import { nanoid } from 'nanoid';
import { NextRequest } from 'next/server';
import { ZodObject } from 'zod';
import { ToolDescriptor, toolRegistry } from '@/tools/registry'
import { llmProviderSetup } from '@/lib/llm-provider';
import { getErrorMessage } from '@/lib/utils';
import { createUpdateResultTool } from '@/tools/updateResultTool';
import { validateTokenQuotas } from '@/lib/quotas';
import { getMimeType, processFiles } from '@/lib/file-extractor';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

interface AgentToolsParams {
  tools: Record<string, ToolConfiguration> | undefined;
  databaseIdHash: string;
  storageKey: string | undefined | null;
  agentId: string;
  sessionId: string;
  agent?: Agent;
  saasContext?: AuthorizedSaaSContext;
  streamingController?: ReadableStreamDefaultController<any> | null;
}

export function prepareAgentTools({
  tools,
  databaseIdHash,
  storageKey,
  agentId,
  sessionId,
  agent,
  saasContext,
  streamingController
}: AgentToolsParams): Record<string, Tool> {
  if (!tools) return {}
  const mappedTools: Record<string, Tool> = {};

  for(const toolKey in tools) {
    const toolConfig = tools[toolKey];
    const toolDescriptor:ToolDescriptor = toolRegistry.init({ 
      databaseIdHash, 
      storageKey, 
      agentId, 
      sessionId, 
      agent, 
      saasContext,
      streamingController
    })[toolConfig.tool];

    if (!toolDescriptor) {
      console.log(`Tool is not available ${toolConfig.tool}`);
      continue;
    }

    const paramsDefaults: Record<string, any> = {}
    for(const preConfiguredOptionKey in toolConfig.options){
      paramsDefaults[preConfiguredOptionKey] = toolConfig.options[preConfiguredOptionKey];
    }

    let nonDefaultParameters = toolDescriptor.tool.parameters;
    if (nonDefaultParameters instanceof ZodObject) {
      const omitKeys: Record<string, true> = Object.fromEntries(
        Object.keys(paramsDefaults).map(key => [key, true])
      );
      nonDefaultParameters = nonDefaultParameters.omit(omitKeys);
    }
    mappedTools[toolKey] = tool({
      description: `${toolConfig.description ? toolConfig.description + ' - ': ''}${toolDescriptor.tool.description}`,
      parameters: nonDefaultParameters,
      execute: async (params, options) => {
        if (toolDescriptor.tool.execute) {
          return toolDescriptor.tool.execute({ ...params, ...paramsDefaults}, options);
        }
        throw new Error(`Tool executor has no execute method defined, tool: ${toolKey} - ${toolConfig.tool}`);
      }
    });
  }
  return mappedTools;
}

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: Message[] } = await req.json();
    const databaseIdHash = req.headers.get('Database-Id-Hash');
    const sessionId = req.headers.get('Agent-Session-Id') || nanoid();
    const agentId = req.headers.get('Agent-Id');

    if(!databaseIdHash || !agentId || !sessionId) {
      return Response.json('The required HTTP headers: Database-Id-Hash, Agent-Session-Id and Agent-Id missing', { status: 400 });
    }

    const repo = new ServerAgentRepository(databaseIdHash);

    const agent = Agent.fromDTO(await repo.findOne({
      id: agentId // TODO: fix seearching as it always return the same record!
    }) as AgentDTO);

    const locale = req.headers.get('Agent-Locale') || agent.locale || 'en';
    const saasContext = await authorizeSaasContext(req, true);


    const currentDateTimeIso = req.headers.get('Current-Datetime-Iso') || new Date().toISOString();
    const currentLocalDateTime = req.headers.get('Current-Datetime') || new Date().toLocaleString();
    const currentTimezone = req.headers.get('Current-Timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;


    if (saasContext.isSaasMode) {
        if (!saasContext.hasAccess) {
            return Response.json({ message: "Unauthorized", status: 403 }, { status: 403 });
        } else {

            if (saasContext.saasContex) {
                const resp = await validateTokenQuotas(saasContext.saasContex)
                if (resp?.status !== 200) {
                    return Response.json(resp)
                }
            } else {
                return Response.json({ message: "Unauthorized", status: 403 }, { status: 403 });
            }
        }
    }  

    const sessionRepo = new ServerSessionRepository(databaseIdHash, saasContext.isSaasMode ? saasContext.saasContex?.storageKey : null);
    let existingSession = await sessionRepo.findOne({ id: sessionId });

    const promptName = agent.agentType ? agent.agentType : 'survey-agent';
    const systemPrompt = await renderPrompt(locale, promptName, { session: existingSession, agent, events: agent.events, currentDateTimeIso, currentLocalDateTime, currentTimezone });

    messages.unshift( {
      id: nanoid(),
      role: 'system',
      content: systemPrompt
    })


    try {
      for (const message of messages) {
        if (message.experimental_attachments) {

              const attachmentsToProcess:Record<string, string> = {};
              message.experimental_attachments.forEach((attachment) => {
                attachmentsToProcess[attachment.name ?? 'default'] = attachment.url;
              });

              // Convert PDF to images or other processing
              const filesToUpload = processFiles({
                inputObject: attachmentsToProcess,
                pdfExtractText: false,
              });

              message.experimental_attachments = [];

              for (const v in filesToUpload) {
                if (filesToUpload[v]) {
                  const fileMapper = (key: string, fileBase64: string) => {
                    if (getMimeType(fileBase64)?.startsWith("image")) {
                      message.experimental_attachments.push({
                        url: fileBase64,
                        contentType: getMimeType(fileBase64) || "application/octet-stream",
                      });
                    } else {
                      (message.parts as Array<TextPart>).push({
                        type: "text",
                        text: `${fileBase64}`,
                      });
                    }
                  };
      
                  if (Array.isArray(filesToUpload[v])) {
                    filesToUpload[v].forEach((fc) => fileMapper(v, fc as string));
                  } else {
                    fileMapper(v, filesToUpload[v] as string);
                  }
                }                
              }                           
        }
        console.log(message);
      }
    } catch (err) {
      console.error("Error converting files", err);
    }


    const result = await streamText({
      model: llmProviderSetup(),
      maxSteps: 10,  
      onError: (error) => {
        console.error('Error in streaming:', error);
      },
      async onFinish({ response, usage }) {
        const chatHistory = [...messages, ...response.messages]
        existingSession = await sessionRepo.upsert({
          id: sessionId
        }, {
          id: sessionId,
          agentId,
          completionTokens: existingSession && existingSession.completionTokens ? usage.completionTokens + existingSession.completionTokens : usage.completionTokens,
          promptTokens: existingSession && existingSession.promptTokens ? usage.promptTokens + existingSession.promptTokens : usage.promptTokens,
          createdAt: existingSession ? existingSession.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: JSON.stringify(chatHistory)
        } as SessionDTO);

        const usageData:StatDTO = {
          eventName: 'chat',
          completionTokens: usage.completionTokens,
          promptTokens: usage.promptTokens,
          createdAt: new Date().toISOString()
        }
        const statsRepo = new ServerStatRepository(databaseIdHash, 'stats');
        const result = await statsRepo.aggregate(usageData)
        if (saasContext.apiClient) {
          try {
            saasContext.apiClient.saveStats(databaseIdHash, {
                ...result,
                databaseIdHash: databaseIdHash
            });
          } catch (e) {
            console.error(e);
          }
      }        

      },
      tools: {
        ...await prepareAgentTools({ tools: agent.tools, databaseIdHash, storageKey: saasContext.isSaasMode ? saasContext.saasContex?.storageKey : null, agentId, sessionId, agent, saasContext }),
        saveResults: createUpdateResultTool(databaseIdHash, saasContext.isSaasMode ? saasContext.saasContex?.storageKey : null).tool
      },
      messages,
    });
    return result.toDataStreamResponse();
  } catch (e) {
    console.error(e);
    return Response.json({
      message: getErrorMessage(e),
      status: 499
    });
  }
}